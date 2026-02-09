from flask import Flask
from psycopg import Connection
from psycopg_pool import ConnectionPool
from config import Config

pool: ConnectionPool | None = None

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    global pool
    pool = ConnectionPool(
        conninfo=app.config['DATABASE_URI'],
        min_size=1,
        max_size=20,
        timeout=30.0
    )
    pool.open(wait=True)

    @app.teardown_appcontext
    def close_db(error):
        pass

    return app

def get_db():
    if pool is None:
        raise RuntimeError("Database pool not initialized. Call create_app() first.")
    return pool.connection()

