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
    cur.execute(
        'SELECT name, testament, category, num_chapters FROM bible_books')
    raw_data = cur.fetchall()
    conn.close()

    books = [{
        "name": item[0],
        "testament": item[1],
        "category": item[2],
        "num_chapters": item[3],
    } for item in raw_data]

    return jsonify(books)


if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5000)
