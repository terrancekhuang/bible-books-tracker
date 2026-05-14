from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import psycopg2
import os
from psycopg2.extras import RealDictCursor
from config import Config

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False
jwt = JWTManager(app)


def get_db_connection():
    conn = psycopg2.connect(
        dbname=Config.DB_NAME,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        host=Config.DB_HOST
    )
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
    SELECT
        b.book_id,
        b.name,
        b.testament,
        b.category,
        b.num_chapters,
        COALESCE(p.chapters_read, 0) AS chapters_read
    FROM bible_books b
    LEFT JOIN progress p ON b.book_id = p.book_id
        AND p.user_id = %s
        AND p.cycle_id = (
            SELECT cycle_id FROM reading_cycles
            WHERE user_id = %s ORDER BY cycle_number DESC LIMIT 1
        )
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
        "chapters_read": item[5]
    } for item in raw_data]

    return jsonify(books)


@app.route('/api/progress', methods=['POST'])
@jwt_required()
def update_progress():
    user_id = int(get_jwt_identity())
    data = request.json
    book_name = data.get('book_name')
    chapters_to_add = data.get('chapters_today')

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

        cur.execute("""
        INSERT INTO progress (user_id, cycle_id, book_id, chapters_read)
        VALUES (%s, %s, %s, LEAST(%s, %s))
        ON CONFLICT (user_id, cycle_id, book_id)
        DO UPDATE SET chapters_read = LEAST(progress.chapters_read + %s, %s)
        RETURNING chapters_read
        """, (user_id, cycle_id, book_id, chapters_to_add, num_chapters, chapters_to_add, num_chapters))

        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not result:
            raise Exception("Failed to update progress.")

        return jsonify({
            'success': True,
            'chapters_read': result['chapters_read']
        })
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({
            'success': False, 'error': str(e)
        }), 500


@app.route('/api/cycles', methods=['GET'])
@jwt_required()
def get_cycles():
    user_id = int(get_jwt_identity())
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                rc.cycle_id,
                rc.cycle_number,
                COALESCE(SUM(p.chapters_read), 0) AS chapters_read,
                COALESCE(SUM(b.num_chapters), 0) AS total_chapters,
                COUNT(CASE WHEN p.chapters_read >= b.num_chapters THEN 1 END) AS books_complete
            FROM reading_cycles rc
            LEFT JOIN progress p ON rc.cycle_id = p.cycle_id AND p.user_id = %s
            LEFT JOIN bible_books b ON p.book_id = b.book_id
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


if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5001)
