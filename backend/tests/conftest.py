import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret-key')
os.environ.setdefault('GOOGLE_CLIENT_ID', 'test-client-id')
os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:pass@localhost:5432/bible-books-tracker')
os.environ.setdefault('FRONTEND_URL', 'http://localhost:3000')

import pytest
import psycopg2
from flask_jwt_extended import create_access_token
from routes import app, initialize_database

_TEST_GOOGLE_ID = 'pytest_fixture_user_google_id'
_TEST_EMAIL = 'pytest_fixture_user@example.com'


def _raw_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


@pytest.fixture(scope='session', autouse=True)
def _init_db():
    initialize_database()


@pytest.fixture(scope='session')
def flask_app(_init_db):
    app.config['TESTING'] = True
    return app


@pytest.fixture(scope='session')
def client(flask_app):
    return flask_app.test_client()


@pytest.fixture(scope='session')
def test_user(flask_app, _init_db):
    """Creates a dedicated test user + cycle once per session. Yields (user_id, jwt)."""
    conn = _raw_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (google_id, email, name, picture_url)
        VALUES (%s, %s, 'Pytest User', '')
        ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email
        RETURNING user_id
    """, (_TEST_GOOGLE_ID, _TEST_EMAIL))
    user_id = cur.fetchone()[0]
    cur.execute("""
        INSERT INTO reading_cycles (user_id, cycle_number) VALUES (%s, 1)
        ON CONFLICT (user_id, cycle_number) DO NOTHING
    """, (user_id,))
    conn.commit()
    cur.close()
    conn.close()

    with flask_app.app_context():
        jwt = create_access_token(identity=str(user_id))

    yield user_id, jwt

    conn = _raw_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()


@pytest.fixture(autouse=True)
def _clean_test_user_state(test_user):
    """Wipes progress + extra cycles for the test user after each test."""
    yield
    user_id, _ = test_user
    conn = _raw_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM chapter_progress WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM reading_cycles WHERE user_id = %s AND cycle_number > 1", (user_id,))
    conn.commit()
    cur.close()
    conn.close()


@pytest.fixture
def auth_headers(test_user):
    _, jwt = test_user
    return {'Authorization': f'Bearer {jwt}'}


@pytest.fixture
def seed_chapter(test_user):
    """Logs a chapter at an explicit time. Yields seed(when, chapter=N, book_id=N).

    POSTing to /api/progress stamps logged_at = NOW(), so every row lands on today's
    weekday and hour — useless for anything that reads a pattern out of the timestamps.
    Rows are wiped by _clean_test_user_state, so callers need no teardown.
    """
    user_id, _ = test_user
    conn = _raw_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT cycle_id FROM reading_cycles WHERE user_id = %s AND cycle_number = 1",
        (user_id,))
    cycle_id = cur.fetchone()[0]

    def seed(when, chapter=1, book_id=1):
        # The primary key is (user_id, cycle_id, book_id, chapter_number), so callers
        # vary `chapter` to log more than one row.
        cur.execute("""
            INSERT INTO chapter_progress
                (user_id, cycle_id, book_id, chapter_number, logged_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, cycle_id, book_id, chapter, when))
        conn.commit()

    yield seed

    cur.close()
    conn.close()
