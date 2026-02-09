from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from config import Config

app = Flask(__name__)
CORS(app)


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
    with open('backend/src/schema.sql', 'r') as f:
        schema_sql = f.read()
    cur.execute(schema_sql)
    conn.commit()


@app.route('/api/books', methods=['GET'])
def get_books():
    conn = get_db_connection()
    cur = conn.cursor()
    user_id = 1
    query = """
    SELECT
        b.book_id,
        b.name,
        b.testament,
        b.category,
        b.num_chapters,
        COALESCE(p.chapters_read, 0) AS chapters_read
    FROM bible_books b
    LEFT JOIN progress p ON b.book_id = p.book_id AND p.user_id = %s
    ORDER BY b.book_id ASC
    """
    cur.execute(query, (user_id,))
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
def update_progress():
    data = request.json
    book_name = data.get('book_name')
    chapters_to_add = data.get('chapters_today')

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(
            "SELECT cycle_id FROM reading_cycles WHERE user_id = 1 ORDER BY cycle_number DESC")
        cycle = cur.fetchone()
        if not cycle:
            return jsonify({'success': False, 'error': 'No active reading cycle found'}), 404
        cycle_id = cycle['cycle_id']

        cur.execute(
            "SELECT book_id FROM bible_books WHERE name = %s", (book_name,))
        book = cur.fetchone()
        if not book:
            return jsonify({'success': False, 'error': f'Book "{book_name}" not found'}), 404
        book_id = book['book_id']

        cur.execute("""
        INSERT INTO progress (user_id, cycle_id, book_id, chapters_read)
        VALUES (1, %s, %s, %s)
        ON CONFLICT (user_id, cycle_id, book_id)
        DO UPDATE SET chapters_read = progress.chapters_read + %s
        RETURNING chapters_read
        """, (cycle_id, book_id, chapters_to_add, chapters_to_add))

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


if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5000)
