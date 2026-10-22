from flask import Flask, request, jsonify
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os
from psycopg2.extras import execute_values
from datetime import datetime, timedelta, timezone
from config import Config
from db import db_cursor
import reading_history

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
jwt = JWTManager(app)


@app.after_request
def refresh_session(response):
    """Slides a signed-in session forward: a token more than a day old comes back renewed in
    `X-Access-Token`, so only 30 days without opening the app signs someone out."""
    try:
        claims = get_jwt()
        if not claims.get('guest') and claims['exp'] - datetime.now(timezone.utc).timestamp() < timedelta(days=29).total_seconds():
            response.headers['X-Access-Token'] = create_access_token(identity=claims['sub'])
    except (RuntimeError, KeyError):
        pass  # no verified token on this request
    return response


def _tz_offset() -> int:
    """Minutes east of UTC, as the client reports it (`-getTimezoneOffset()`)."""
    return int(request.args.get('tz_offset', 0))


def _user_id() -> int | None:
    """The caller's user, or None for a signed-out visitor on an optional-JWT route."""
    identity = get_jwt_identity()
    return int(identity) if identity else None


_book_cache: dict | None = None

def get_book_by_name(name: str) -> dict | None:
    global _book_cache
    if _book_cache is None:
        with db_cursor() as (conn, cur):
            cur.execute("SELECT book_id, name, num_chapters FROM bible_books")
            _book_cache = {row['name']: dict(row) for row in cur.fetchall()}
    return _book_cache.get(name)


def get_active_cycle_id(cur, user_id: int) -> int | None:
    cur.execute(
        "SELECT cycle_id FROM reading_cycles WHERE user_id = %s ORDER BY cycle_number DESC LIMIT 1",
        (user_id,))
    row = cur.fetchone()
    return row['cycle_id'] if row else None


def resolve_cycle_and_book(cur, user_id: int, book_name: str):
    """Returns (cycle_id, book) on success, or (None, (response, status)) on failure."""
    cycle_id = get_active_cycle_id(cur, user_id)
    if not cycle_id:
        return None, (jsonify({'success': False, 'error': 'No active reading cycle found'}), 404)

    book = get_book_by_name(book_name)
    if not book:
        return None, (jsonify({'success': False, 'error': f'Book "{book_name}" not found'}), 404)

    return (cycle_id, book), None


# The chapters an undo would remove: every row sharing the book's latest logged_at. One
# submit is one transaction and logged_at defaults to NOW(), so that's exactly one entry.
LAST_ENTRY = """
    COALESCE(
        ARRAY_AGG(chapter_number ORDER BY chapter_number) FILTER (
            WHERE logged_at = (SELECT MAX(logged_at) FROM chapter_progress last
                               WHERE last.user_id = cp.user_id AND last.cycle_id = cp.cycle_id
                                 AND last.book_id = cp.book_id)
        ),
        ARRAY[]::INTEGER[]
    )"""


def get_book_chapters(cur, user_id: int, cycle_id: int, book_id: int) -> dict:
    cur.execute(f"""
        SELECT COUNT(*) AS chapters_read,
            COALESCE(
                ARRAY_AGG(chapter_number ORDER BY chapter_number) FILTER (WHERE chapter_number IS NOT NULL),
                ARRAY[]::INTEGER[]
            ) AS list,
            {LAST_ENTRY} AS last_entry
        FROM chapter_progress cp
        WHERE user_id = %s AND cycle_id = %s AND book_id = %s
    """, (user_id, cycle_id, book_id))
    result = cur.fetchone()
    return {
        'chapters_read': result['chapters_read'],
        'chapters_read_list': list(result['list'] or []),
        'last_entry': list(result['last_entry'] or []),
    }


def initialize_database():
    with db_cursor(cursor_factory=None) as (conn, cur):
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        cur.execute(schema_sql)
        conn.commit()


@app.route('/auth/google', methods=['POST'])
@jwt_required(optional=True)
def auth_google():
    """Sign in with Google. A guest's token, if sent, carries their progress over: a new
    Google account takes over the guest row as is; an existing one gets the guest's
    current-cycle chapters merged into its current cycle, and the guest row is deleted."""
    data = request.get_json()
    credential = data.get('credential')
    if not credential:
        return jsonify({'error': 'Missing credential'}), 400

    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            Config.GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        return jsonify({'error': f'Invalid token: {e}'}), 401

    google_id = idinfo['sub']
    email = idinfo.get('email', '')
    name = idinfo.get('name', '')
    picture = idinfo.get('picture', '')

    guest_id = _user_id() if get_jwt().get('guest') else None
    from_guest, chapters_added = None, 0

    with db_cursor() as (conn, cur):
        if guest_id:
            cur.execute("SELECT 1 FROM users WHERE google_id = %s", (google_id,))
            if not cur.fetchone():
                cur.execute("""
                    UPDATE users SET google_id = %s, email = %s, name = %s, picture_url = %s
                    WHERE user_id = %s AND google_id IS NULL
                """, (google_id, email, name, picture, guest_id))
                if cur.rowcount:
                    from_guest = 'upgraded'

        if from_guest:
            user_id = guest_id
        else:
            cur.execute("""
                INSERT INTO users (google_id, email, name, picture_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (google_id) DO UPDATE SET
                    email = EXCLUDED.email,
                    name = EXCLUDED.name,
                    picture_url = EXCLUDED.picture_url
                RETURNING user_id
            """, (google_id, email, name, picture))
            user_id = cur.fetchone()['user_id']

            cur.execute("""
                INSERT INTO reading_cycles (user_id, cycle_number)
                VALUES (%s, 1)
                ON CONFLICT (user_id, cycle_number) DO NOTHING
            """, (user_id,))

            if guest_id:
                chapters_added = merge_guest(cur, guest_id, user_id)
                from_guest = 'merged'

        conn.commit()

    access_token = create_access_token(identity=str(user_id))
    return jsonify({
        'access_token': access_token,
        'user_id': user_id,
        'from_guest': from_guest,
        'chapters_added': chapters_added,
    })


def merge_guest(cur, guest_id: int, user_id: int) -> int:
    """Move a guest's current-cycle chapters into the account's current cycle, then delete
    the guest. A chapter both have keeps the account's row. Returns how many were added."""
    guest_cycle = get_active_cycle_id(cur, guest_id)
    added = 0
    if guest_cycle:
        cur.execute("""
            INSERT INTO chapter_progress (user_id, cycle_id, book_id, chapter_number, logged_at)
            SELECT %(user)s, %(cycle)s, book_id, chapter_number, logged_at
            FROM chapter_progress WHERE user_id = %(guest)s AND cycle_id = %(guest_cycle)s
            ON CONFLICT DO NOTHING
        """, {'user': user_id, 'cycle': get_active_cycle_id(cur, user_id),
              'guest': guest_id, 'guest_cycle': guest_cycle})
        added = cur.rowcount
    cur.execute("DELETE FROM users WHERE user_id = %s AND google_id IS NULL", (guest_id,))
    return added


@app.route('/auth/guest', methods=['POST'])
def auth_guest():
    """A guest account, created on a visitor's first write. Its token never expires:
    a guest has no other way back in, so an expired token would lose their progress."""
    # Rate-limited per IP in nginx/bible-tracker.conf, not here.
    with db_cursor() as (conn, cur):
        cur.execute("INSERT INTO users DEFAULT VALUES RETURNING user_id")
        user_id = cur.fetchone()['user_id']
        cur.execute("INSERT INTO reading_cycles (user_id, cycle_number) VALUES (%s, 1)", (user_id,))
        conn.commit()

    access_token = create_access_token(
        identity=str(user_id), expires_delta=False, additional_claims={'guest': True})
    return jsonify({'access_token': access_token, 'user_id': user_id})


@app.route('/auth/me', methods=['GET'])
@jwt_required()
def auth_me():
    user_id = int(get_jwt_identity())
    with db_cursor() as (conn, cur):
        cur.execute("SELECT user_id, email, name, picture_url FROM users WHERE user_id = %s", (user_id,))
        user = cur.fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'user_id': user['user_id'],
        'email': user['email'],
        'name': user['name'],
        'picture_url': user['picture_url'],
    })


@app.route('/api/books', methods=['GET'])
@jwt_required(optional=True)
def get_books():
    user_id = _user_id()
    with db_cursor() as (conn, cur):
        cycle_id = get_active_cycle_id(cur, user_id)

        cur.execute(f"""
            SELECT
                b.book_id,
                b.name,
                b.testament,
                b.category,
                b.num_chapters,
                COUNT(cp.chapter_number) AS chapters_read,
                COALESCE(
                    ARRAY_AGG(cp.chapter_number ORDER BY cp.chapter_number)
                    FILTER (WHERE cp.chapter_number IS NOT NULL),
                    ARRAY[]::INTEGER[]
                ) AS chapters_read_list,
                MAX(cp.logged_at) AS last_read_at,
                {LAST_ENTRY} AS last_entry
            FROM bible_books b
            LEFT JOIN chapter_progress cp ON b.book_id = cp.book_id
                AND cp.user_id = %s
                AND cp.cycle_id = %s
            GROUP BY b.book_id, b.name, b.testament, b.category, b.num_chapters
            ORDER BY b.book_id ASC
        """, (user_id, cycle_id))
        raw_data = cur.fetchall()

    books = [{
        "book_id": item['book_id'],
        "name": item['name'],
        "testament": item['testament'],
        "category": item['category'],
        "num_chapters": item['num_chapters'],
        "chapters_read": item['chapters_read'],
        "chapters_read_list": item['chapters_read_list'],
        "last_read_at": item['last_read_at'].isoformat() if item['last_read_at'] else None,
        "last_entry": item['last_entry'],
    } for item in raw_data]

    return jsonify(books)


@app.route('/api/progress', methods=['POST'])
@jwt_required()
def update_progress():
    user_id = int(get_jwt_identity())
    data = request.json
    book_name = data.get('book_name')
    chapter_numbers = data.get('chapters', [])

    with db_cursor() as (conn, cur):
        try:
            resolved, error = resolve_cycle_and_book(cur, user_id, book_name)
            if error:
                return error
            cycle_id, book = resolved
            book_id = book['book_id']
            num_chapters = book['num_chapters']

            chapter_numbers = [ch for ch in chapter_numbers if 1 <= ch <= num_chapters]
            if not chapter_numbers:
                return jsonify({'success': False, 'error': 'No valid chapter numbers provided'}), 400

            inserted_rows = execute_values(cur,
                "INSERT INTO chapter_progress (user_id, cycle_id, book_id, chapter_number) VALUES %s ON CONFLICT DO NOTHING RETURNING chapter_number",
                [(user_id, cycle_id, book_id, ch) for ch in chapter_numbers],
                fetch=True,
            )
            newly_inserted = len(inserted_rows)
            result = get_book_chapters(cur, user_id, cycle_id, book_id)

            conn.commit()
            return jsonify({
                'success': True,
                'chapters_read': result['chapters_read'],
                'newly_logged': newly_inserted,
                'chapters_read_list': result['chapters_read_list'],
                'last_entry': result['last_entry'],
            })
        except Exception as e:
            conn.rollback()
            return jsonify({
                'success': False, 'error': str(e)
            }), 500


@app.route('/api/progress/undo', methods=['POST'])
@jwt_required()
def undo_progress():
    user_id = int(get_jwt_identity())
    data = request.json
    book_name = data.get('book_name')
    with db_cursor() as (conn, cur):
        try:
            resolved, error = resolve_cycle_and_book(cur, user_id, book_name)
            if error:
                return error
            cycle_id, book = resolved
            book_id = book['book_id']

            cur.execute("""
                SELECT MAX(logged_at) AS latest FROM chapter_progress
                WHERE user_id = %s AND cycle_id = %s AND book_id = %s
            """, (user_id, cycle_id, book_id))
            row = cur.fetchone()
            if not row['latest']:
                return jsonify({'success': False, 'error': 'Nothing to undo'}), 400
            latest = row['latest']

            cur.execute("""
                DELETE FROM chapter_progress
                WHERE user_id = %s AND cycle_id = %s AND book_id = %s AND logged_at = %s
            """, (user_id, cycle_id, book_id, latest))

            result = get_book_chapters(cur, user_id, cycle_id, book_id)
            conn.commit()
            return jsonify({'success': True, **result})
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/progress/reset', methods=['POST'])
@jwt_required()
def reset_progress():
    user_id = int(get_jwt_identity())
    data = request.json
    book_name = data.get('book_name')
    with db_cursor() as (conn, cur):
        try:
            resolved, error = resolve_cycle_and_book(cur, user_id, book_name)
            if error:
                return error
            cycle_id, book = resolved
            book_id = book['book_id']

            cur.execute("""
                DELETE FROM chapter_progress
                WHERE user_id = %s AND cycle_id = %s AND book_id = %s
            """, (user_id, cycle_id, book_id))

            conn.commit()
            return jsonify({'success': True, 'chapters_read': 0, 'chapters_read_list': [], 'last_entry': []})
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/cycles', methods=['GET'])
@jwt_required(optional=True)
def get_cycles():
    user_id = _user_id()
    with db_cursor() as (conn, cur):
        cur.execute("""
            WITH cycle_book_counts AS (
                SELECT cycle_id, book_id, COUNT(*) AS chap_count
                FROM chapter_progress
                WHERE user_id = %s
                GROUP BY cycle_id, book_id
            )
            SELECT
                rc.cycle_id,
                rc.cycle_number,
                COALESCE(SUM(cbc.chap_count), 0)::BIGINT AS chapters_read,
                COALESCE(SUM(b.num_chapters), 0)::BIGINT AS total_chapters,
                COUNT(CASE WHEN cbc.chap_count >= b.num_chapters THEN 1 END)::BIGINT AS books_complete
            FROM reading_cycles rc
            LEFT JOIN cycle_book_counts cbc ON rc.cycle_id = cbc.cycle_id
            LEFT JOIN bible_books b ON cbc.book_id = b.book_id
            WHERE rc.user_id = %s
            GROUP BY rc.cycle_id, rc.cycle_number
            ORDER BY rc.cycle_number ASC
        """, (user_id, user_id))
        cycles = cur.fetchall()
    return jsonify([dict(c) for c in cycles])


@app.route('/api/cycles', methods=['POST'])
@jwt_required()
def create_cycle():
    user_id = int(get_jwt_identity())
    with db_cursor() as (conn, cur):
        cur.execute("""
            INSERT INTO reading_cycles (user_id, cycle_number)
            SELECT %s, COALESCE(MAX(cycle_number), 0) + 1
            FROM reading_cycles WHERE user_id = %s
            RETURNING cycle_id, cycle_number
        """, (user_id, user_id))
        cycle = cur.fetchone()
        conn.commit()
    return jsonify({'cycle_id': cycle['cycle_id'], 'cycle_number': cycle['cycle_number']})


@app.route('/api/rhythm', methods=['GET'])
@jwt_required(optional=True)
def get_rhythm():
    user_id = _user_id()
    return jsonify(reading_history.rhythm(user_id, _tz_offset()))


@app.route('/api/dashboard', methods=['GET'])
@jwt_required(optional=True)
def get_dashboard():
    user_id = _user_id()
    overview = reading_history.overview(user_id, _tz_offset())

    with db_cursor() as (conn, cur):
        cur.execute("SELECT weekly_goal, name, picture_url FROM users WHERE user_id = %s", (user_id,))
        user_row = cur.fetchone()

    return jsonify({
        **overview,
        'weekly_goal': user_row['weekly_goal'] if user_row else 7,
        'user': {
            'name': user_row['name'] if user_row else None,
            'picture_url': user_row['picture_url'] if user_row else None,
        },
    })


@app.route('/api/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data:
        return jsonify({'error': 'request body required'}), 400
    weekly_goal = data.get('weekly_goal')
    if not isinstance(weekly_goal, int) or isinstance(weekly_goal, bool) or weekly_goal < 1:
        return jsonify({'error': 'weekly_goal must be a positive integer'}), 400
    with db_cursor(cursor_factory=None) as (conn, cur):
        cur.execute("UPDATE users SET weekly_goal = %s WHERE user_id = %s", (weekly_goal, user_id))
        conn.commit()
    return jsonify({'weekly_goal': weekly_goal})


if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5001)
