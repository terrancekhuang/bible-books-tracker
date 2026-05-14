import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


class Config:
    DATABASE_URL = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:pass@localhost:5432/bible-books-tracker'
    )

    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-fallback-change-me')
