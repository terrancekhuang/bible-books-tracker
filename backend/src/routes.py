from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import psycopg2
import os
from psycopg2.extras import RealDictCursor, execute_values
from datetime import date, datetime, timezone, timedelta
from config import Config

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False
jwt = JWTManager(app)


def get_db_connection():
    conn = psycopg2.connect(Config.DATABASE_URL)
    return conn


def initialize_database():
    conn = get_db_connection()
    cur = conn.cursor()
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

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
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
    finally:
        cur.close()
        conn.close()

    access_token = create_access_token(identity=str(user_id))
    return jsonify({'access_token': access_token, 'user_id': user_id})


@app.route('/auth/me', methods=['GET'])
@jwt_required()
def auth_me():
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT user_id, email, name, picture_url FROM users WHERE user_id = %s", (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
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
    conn = get_db_connection()
    cur = conn.cursor()
    query = """
    WITH latest_cycle AS (
        SELECT cycle_id FROM reading_cycles
        WHERE user_id = %s ORDER BY cycle_number DESC LIMIT 1
    )
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
        AND cp.cycle_id = (SELECT cycle_id FROM latest_cycle)
    GROUP BY b.book_id, b.name, b.testament, b.category, b.num_chapters
    ORDER BY b.book_id ASC
    """
    cur.execute(query, (user_id, user_id))
    raw_data = cur.fetchall()
    conn.close()

    books = [{
        "book_id": item[0],
        "name": item[1],
        "testament": item[2],
        "category": item[3],
        "num_chapters": item[4],
        "chapters_read": item[5],
        "chapters_read_list": list(item[6]) if item[6] else [],
        "last_read_at": item[7].isoformat() if item[7] else None,
    } for item in raw_data]

    return jsonify(books)


@app.route('/api/progress', methods=['POST'])
@jwt_required()
def update_progress():
    user_id = int(get_jwt_identity())
    data = request.json
    book_name = data.get('book_name')
    chapter_numbers = data.get('chapters', [])

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(
            "SELECT cycle_id FROM reading_cycles WHERE user_id = %s ORDER BY cycle_number DESC",
            (user_id,))
        cycle = cur.fetchone()
        if not cycle:
            return jsonify({'success': False, 'error': 'No active reading cycle found'}), 404
        cycle_id = cycle['cycle_id']

        cur.execute(
            "SELECT book_id, num_chapters FROM bible_books WHERE name = %s", (book_name,))
        book = cur.fetchone()
        if not book:
            return jsonify({'success': False, 'error': f'Book "{book_name}" not found'}), 404
        book_id = book['book_id']
        num_chapters = book['num_chapters']

        chapter_numbers = [ch for ch in chapter_numbers if 1 <= ch <= num_chapters]
        if not chapter_numbers:
            return jsonify({'success': False, 'error': 'No valid chapter numbers provided'}), 400

        execute_values(cur,
            "INSERT INTO chapter_progress (user_id, cycle_id, book_id, chapter_number) VALUES %s ON CONFLICT DO NOTHING",
            [(user_id, cycle_id, book_id, ch) for ch in chapter_numbers]
        )
        newly_inserted = cur.rowcount

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

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'success': True,
            'chapters_read': result['chapters_read'],
            'newly_logged': newly_inserted,
            'chapters_read_list': list(result['list'] or []),
        })
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({
            'success': False, 'error': str(e)
        }), 500


@app.route('/api/progress/undo', methods=['POST'])
@jwt_required()
def undo_progress():
    user_id = int(get_jwt_identity())
    data = request.json
    book_name = data.get('book_name')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT cycle_id FROM reading_cycles WHERE user_id = %s ORDER BY cycle_number DESC",
            (user_id,))
        cycle = cur.fetchone()
        if not cycle:
            return jsonify({'success': False, 'error': 'No active cycle'}), 404
        cycle_id = cycle['cycle_id']

        cur.execute("SELECT book_id FROM bible_books WHERE name = %s", (book_name,))
        book = cur.fetchone()
        if not book:
            return jsonify({'success': False, 'error': 'Book not found'}), 404
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

        conn.commit()
        return jsonify({
            'success': True,
            'chapters_read': result['chapters_read'],
            'chapters_read_list': list(result['list'] or []),
        })
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/api/cycles', methods=['GET'])
@jwt_required()
def get_cycles():
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
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
    finally:
        cur.close()
        conn.close()
    return jsonify([dict(c) for c in cycles])


@app.route('/api/cycles', methods=['POST'])
@jwt_required()
def create_cycle():
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            INSERT INTO reading_cycles (user_id, cycle_number)
            SELECT %s, COALESCE(MAX(cycle_number), 0) + 1
            FROM reading_cycles WHERE user_id = %s
            RETURNING cycle_id, cycle_number
        """, (user_id, user_id))
        cycle = cur.fetchone()
        conn.commit()
    finally:
        cur.close()
        conn.close()
    return jsonify({'cycle_id': cycle['cycle_id'], 'cycle_number': cycle['cycle_number']})


@app.route('/api/activity', methods=['GET'])
@jwt_required()
def get_activity():
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT DATE_TRUNC('day', logged_at) AS logged_at, COUNT(*) AS chapters
            FROM chapter_progress
            WHERE user_id = %s
              AND logged_at >= NOW() - INTERVAL '365 days'
            GROUP BY DATE_TRUNC('day', logged_at)
            ORDER BY logged_at
        """, (user_id,))
        rows = cur.fetchall()
        return jsonify([{'logged_at': r['logged_at'].isoformat(), 'chapters': r['chapters']} for r in rows])
    finally:
        cur.close()
        conn.close()


@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = int(get_jwt_identity())
    tz_offset = int(request.args.get('tz_offset', 0))  # minutes: -getTimezoneOffset()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Compute UTC boundaries for the client's local day and week
        local_now = datetime.now(timezone.utc) + timedelta(minutes=tz_offset)
        local_today = local_now.date()
        today_start_utc = datetime(local_today.year, local_today.month, local_today.day,
                                   tzinfo=timezone.utc) - timedelta(minutes=tz_offset)
        today_end_utc   = today_start_utc + timedelta(days=1)
        # ISO week: Monday start
        week_start_date = local_today - timedelta(days=local_today.weekday())
        week_start_utc  = datetime(week_start_date.year, week_start_date.month, week_start_date.day,
                                   tzinfo=timezone.utc) - timedelta(minutes=tz_offset)

        cur.execute("""
            SELECT COUNT(*) AS total_chapters,
                   COUNT(DISTINCT (logged_at + INTERVAL '1 minute' * %s)::date) AS total_days
            FROM chapter_progress WHERE user_id = %s
        """, (tz_offset, user_id))
        totals = cur.fetchone()

        cur.execute("""
            WITH local_dates AS (
                SELECT DISTINCT (logged_at + INTERVAL '1 minute' * %s)::date AS read_date
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

        cur.execute("""
            SELECT
                COALESCE(COUNT(CASE WHEN logged_at >= %s AND logged_at < %s THEN 1 END), 0) AS chapters_today,
                COALESCE(COUNT(CASE WHEN logged_at >= %s THEN 1 END), 0) AS chapters_this_week
            FROM chapter_progress WHERE user_id = %s
        """, (today_start_utc, today_end_utc, week_start_utc, user_id))
        period_row = cur.fetchone()

        return jsonify({
            'total_chapters': int(totals['total_chapters']),
            'total_days': int(totals['total_days']),
            'best_streak': int(streak_row['best_streak'] or 0),
            'current_streak': int(streak_row['current_streak'] or 0),
            'chapters_today': int(period_row['chapters_today']),
            'chapters_this_week': int(period_row['chapters_this_week']),
        })
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5001)
