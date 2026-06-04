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
