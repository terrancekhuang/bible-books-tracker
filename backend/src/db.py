"""Pooled Postgres access.

Owns the connection pool so that nothing importing it has to know a pool exists.
Callers take a cursor from `db_cursor()` and own commit/rollback on writes.
"""

import psycopg2
import psycopg2.pool
from contextlib import contextmanager
from psycopg2.extras import RealDictCursor
from config import Config


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
