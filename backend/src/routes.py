from flask import Flask, jsonify
import psycopg2
from config import Config

app = Flask(__name__)


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


if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5000)
