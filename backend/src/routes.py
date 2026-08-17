from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import psycopg2
import psycopg2.pool
import os
from contextlib import contextmanager
from psycopg2.extras import RealDictCursor, execute_values
from datetime import date, datetime, timezone, timedelta
from config import Config

app = Flask(__name__)
CORS(app, origins=[Config.FRONTEND_URL], supports_credentials=True)
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
jwt = JWTManager(app)


_db_pool = None

def _get_pool():
    global _db_pool
    if _db_pool is None or _db_pool.closed:
        _db_pool = psycopg2.pool.ThreadedConnectionPool(1, 5, Config.DATABASE_URL)
    return _db_pool

def get_db_connection():
    return _get_pool().getconn()

def release_db_connection(conn):
    pool = _get_pool()
    if pool and not pool.closed:
        pool.putconn(conn)
    else:
        conn.close()


@contextmanager
def db_cursor(cursor_factory=RealDictCursor):
    """Acquire a pooled connection + cursor, always releasing it. Callers own commit/rollback."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=cursor_factory)
    try:
        yield conn, cur
    finally:
        cur.close()
        release_db_connection(conn)


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


def get_book_chapters(cur, user_id: int, cycle_id: int, book_id: int) -> dict:
    cur.execute("""
        SELECT COUNT(*) AS chapters_read,
            COALESCE(
                ARRAY_AGG(chapter_number ORDER BY chapter_number) FILTER (WHERE chapter_number IS NOT NULL),
                ARRAY[]::INTEGER[]
            ) AS list
        FROM chapter_progress
        WHERE user_id = %s AND cycle_id = %s AND book_id = %s
    """, (user_id, cycle_id, book_id))
    result = cur.fetchone()
    return {
        'chapters_read': result['chapters_read'],
        'chapters_read_list': list(result['list'] or []),
    }


def initialize_database():
    with db_cursor(cursor_factory=None) as (conn, cur):
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        cur.execute(schema_sql)
        conn.commit()


@app.route('/auth/google', methods=['POST'])
def auth_google():
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

    with db_cursor() as (conn, cur):
        cur.execute("""
            INSERT INTO users (google_id, email, name, picture_url)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (google_id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                picture_url = EXCLUDED.picture_url
            RETURNING user_id
        """, (google_id, email, name, picture))
        user = cur.fetchone()
        user_id = user['user_id']

        cur.execute("""
            INSERT INTO reading_cycles (user_id, cycle_number)
            VALUES (%s, 1)
            ON CONFLICT (user_id, cycle_number) DO NOTHING
        """, (user_id,))

        conn.commit()

    access_token = create_access_token(identity=str(user_id))
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
@jwt_required()
def get_books():
    user_id = int(get_jwt_identity())
    with db_cursor() as (conn, cur):
        cycle_id = get_active_cycle_id(cur, user_id)

        cur.execute("""
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
                MAX(cp.logged_at) AS last_read_at
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
            return jsonify({'success': True, 'chapters_read': 0, 'chapters_read_list': []})
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/cycles', methods=['GET'])
@jwt_required()
def get_cycles():
    user_id = int(get_jwt_identity())
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


# Timestamps are stored UTC and converted to the user's local time on read, with tz_offset
# (minutes east of UTC) as the only shift. Getting that right needs `AT TIME ZONE 'UTC'`
# first: logged_at is TIMESTAMPTZ, and ::date or EXTRACT on one resolves it in the *session*
# timezone, so without the pin the result shifts by tz_offset **plus** wherever the server
# happens to think it is. That silently reshapes the heatmap, streaks and rhythm for any
# session that isn't UTC. Every query below that groups by local day or hour relies on this.


def _compute_activity(cur, user_id: int, tz_offset: int) -> list[dict]:
    cutoff_utc = datetime.now(timezone.utc) - timedelta(days=365)
    cur.execute("""
        SELECT lts::date AS local_date, COUNT(*) AS chapters
        FROM (SELECT (logged_at AT TIME ZONE 'UTC') + INTERVAL '1 minute' * %s AS lts
              FROM chapter_progress
              WHERE user_id = %s AND logged_at >= %s) t
        GROUP BY local_date
        ORDER BY local_date
    """, (tz_offset, user_id, cutoff_utc))
    rows = cur.fetchall()
    return [{'logged_at': r['local_date'].isoformat(), 'chapters': r['chapters']} for r in rows]


@app.route('/api/activity', methods=['GET'])
@jwt_required()
def get_activity():
    user_id = int(get_jwt_identity())
    tz_offset = int(request.args.get('tz_offset', 0))  # minutes: -getTimezoneOffset()
    with db_cursor() as (conn, cur):
        return jsonify(_compute_activity(cur, user_id, tz_offset))


def _compute_stats(cur, user_id: int, tz_offset: int) -> dict:
    local_now = datetime.now(timezone.utc) + timedelta(minutes=tz_offset)
    local_today = local_now.date()
    today_start_utc = datetime(local_today.year, local_today.month, local_today.day,
                               tzinfo=timezone.utc) - timedelta(minutes=tz_offset)
    today_end_utc = today_start_utc + timedelta(days=1)
    week_start_date = local_today - timedelta(days=local_today.weekday())
    week_start_utc = datetime(week_start_date.year, week_start_date.month, week_start_date.day,
                              tzinfo=timezone.utc) - timedelta(minutes=tz_offset)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    cur.execute("""
        SELECT
            COUNT(*) AS total_chapters,
            COUNT(DISTINCT ((logged_at AT TIME ZONE 'UTC') + INTERVAL '1 minute' * %s)::date) AS total_days,
            COUNT(CASE WHEN logged_at >= %s AND logged_at < %s THEN 1 END) AS chapters_today,
            COUNT(CASE WHEN logged_at >= %s THEN 1 END) AS chapters_this_week,
            COUNT(CASE WHEN logged_at >= %s THEN 1 END) AS chapters_last_7_days
        FROM chapter_progress WHERE user_id = %s
    """, (tz_offset, today_start_utc, today_end_utc, week_start_utc, seven_days_ago, user_id))
    agg = cur.fetchone()

    cur.execute("""
        WITH local_dates AS (
            SELECT DISTINCT ((logged_at AT TIME ZONE 'UTC') + INTERVAL '1 minute' * %s)::date AS read_date
            FROM chapter_progress WHERE user_id = %s
        ),
        dates AS (
            SELECT read_date,
                   (read_date - (ROW_NUMBER() OVER (ORDER BY read_date) || ' days')::interval)::date AS grp
            FROM local_dates
        ),
        streaks AS (
            SELECT COUNT(*) AS length, MAX(read_date) AS last_day
            FROM dates GROUP BY grp
        )
        SELECT
            MAX(length) AS best_streak,
            (SELECT length FROM streaks
             WHERE last_day >= %s - INTERVAL '1 day'
             ORDER BY last_day DESC LIMIT 1) AS current_streak
        FROM streaks
    """, (tz_offset, user_id, local_today))
    streak_row = cur.fetchone()

    return {
        'total_chapters': int(agg['total_chapters']),
        'total_days': int(agg['total_days']),
        'best_streak': int(streak_row['best_streak'] or 0),
        'current_streak': int(streak_row['current_streak'] or 0),
        'chapters_today': int(agg['chapters_today']),
        'chapters_this_week': int(agg['chapters_this_week']),
        'chapters_last_7_days': int(agg['chapters_last_7_days']),
    }


@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = int(get_jwt_identity())
    tz_offset = int(request.args.get('tz_offset', 0))
    with db_cursor() as (conn, cur):
        return jsonify(_compute_stats(cur, user_id, tz_offset))


# Which part of the day each local hour belongs to. Night wraps midnight, so it's the
# fallback rather than a range: hours 22-23 and 0-4 both land there.
_PARTS_OF_DAY = (
    ('morning', range(5, 12)),
    ('afternoon', range(12, 17)),
    ('evening', range(17, 22)),
)


def _part_of_day(hour: int) -> str:
    for name, hours in _PARTS_OF_DAY:
        if hour in hours:
            return name
    return 'night'


def _empty_window() -> dict:
    return {
        'by_weekday': [0] * 7,
        'by_part_of_day': {'morning': 0, 'afternoon': 0, 'evening': 0, 'night': 0},
        'total_chapters': 0,
        'distinct_days': 0,
    }


def _compute_rhythm(cur, user_id: int, tz_offset: int) -> dict:
    """When the user reads: chapters by local weekday and part of day, for two windows.

    Both windows come back in one payload so the Profile toggle can switch between them
    without a refetch. `logged_at` records when a chapter was *logged*, not when it was
    read — the weekday signal survives batched logging, the part-of-day signal is softer.
    """
    recent_cutoff_utc = datetime.now(timezone.utc) - timedelta(days=90)
    windows = {'all_time': _empty_window(), 'last_90_days': _empty_window()}

    # Grouping by (weekday, hour, recent) caps this at 7 * 24 * 2 rows, so one scan
    # serves both windows and the bucketing happens over a handful of rows in Python.
    cur.execute("""
        SELECT EXTRACT(ISODOW FROM lts)::int AS weekday,
               EXTRACT(HOUR FROM lts)::int   AS hour,
               (logged_at >= %s)             AS recent,
               COUNT(*)                      AS chapters
        FROM (SELECT logged_at,
                     (logged_at AT TIME ZONE 'UTC') + INTERVAL '1 minute' * %s AS lts
              FROM chapter_progress WHERE user_id = %s) t
        GROUP BY weekday, hour, recent
    """, (recent_cutoff_utc, tz_offset, user_id))

    for row in cur.fetchall():
        chapters = int(row['chapters'])
        part = _part_of_day(int(row['hour']))
        # ISODOW is Monday=1..Sunday=7, so weekday-1 indexes a Monday-first list directly.
        weekday_index = int(row['weekday']) - 1
        targets = [windows['all_time']] + ([windows['last_90_days']] if row['recent'] else [])
        for target in targets:
            target['by_weekday'][weekday_index] += chapters
            target['by_part_of_day'][part] += chapters
            target['total_chapters'] += chapters

    # Distinct local dates, not row counts — a 10-chapter day is one day. Kept separate
    # because it can't be summed out of the grouped counts above.
    cur.execute("""
        SELECT COUNT(DISTINCT lts::date)                                AS all_days,
               COUNT(DISTINCT lts::date) FILTER (WHERE logged_at >= %s) AS recent_days
        FROM (SELECT logged_at,
                     (logged_at AT TIME ZONE 'UTC') + INTERVAL '1 minute' * %s AS lts
              FROM chapter_progress WHERE user_id = %s) t
    """, (recent_cutoff_utc, tz_offset, user_id))
    days = cur.fetchone()
    windows['all_time']['distinct_days'] = int(days['all_days'] or 0)
    windows['last_90_days']['distinct_days'] = int(days['recent_days'] or 0)

    return windows


@app.route('/api/rhythm', methods=['GET'])
@jwt_required()
def get_rhythm():
    user_id = int(get_jwt_identity())
    tz_offset = int(request.args.get('tz_offset', 0))
    with db_cursor() as (conn, cur):
        return jsonify(_compute_rhythm(cur, user_id, tz_offset))


@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    user_id = int(get_jwt_identity())
    tz_offset = int(request.args.get('tz_offset', 0))
    with db_cursor() as (conn, cur):
        activity = _compute_activity(cur, user_id, tz_offset)

        cur.execute("SELECT weekly_goal, name, picture_url FROM users WHERE user_id = %s", (user_id,))
        user_row = cur.fetchone()

        return jsonify({
            'stats': _compute_stats(cur, user_id, tz_offset),
            'activity': activity,
            'weekly_goal': user_row['weekly_goal'] if user_row else 7,
            'user': {
                'name': user_row['name'] if user_row else None,
                'picture_url': user_row['picture_url'] if user_row else None,
            },
        })


@app.route('/api/settings', methods=['GET'])
@jwt_required()
def get_settings():
    user_id = int(get_jwt_identity())
    with db_cursor() as (conn, cur):
        cur.execute("SELECT weekly_goal FROM users WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
    return jsonify({'weekly_goal': row['weekly_goal'] if row else 7})


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
