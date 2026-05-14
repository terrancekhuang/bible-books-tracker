# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Full-stack Bible reading progress tracker with two separate servers:

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + DaisyUI, served on port 3000 (default Vite port)
- **Backend**: Python Flask + psycopg2, served on port 5000
- **Database**: PostgreSQL (`bible-books-tracker` db, user `postgres`, password `pass`, localhost:5432)

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so the frontend uses relative `/api/` paths for all routes except the initial book fetch (which still hardcodes `http://localhost:5000/api/books`).

## Running the project

**Database** (one-time setup, from repo root):
```bash
# Option A: Docker
docker compose up -d   # starts PostgreSQL on port 5432; schema and seed data load automatically on first run

# Option B: local PostgreSQL (Homebrew)
bash scripts/setup_db.sh   # creates the postgres role and bible-books-tracker database
```

**Frontend** (from repo root):
```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # tsc + vite build
npm run lint     # eslint
```

**Backend** (from repo root):
```bash
python backend/src/routes.py   # starts Flask on port 5001; also runs initialize_database() on startup
```

The backend reads `backend/src/schema.sql` relative to the repo root — run it from the project root, not from inside `backend/src/`.

Note: Flask runs on port **5001** (not 5000) because macOS AirPlay Receiver occupies port 5000.

Database state is persisted in a Docker volume (`postgres_data`), so data survives container restarts. To reset to a clean state: `docker compose down -v && docker compose up -d`.

## Database schema

Four tables: `bible_books` (static seed data), `users`, `reading_cycles`, `progress`.

Progress is scoped to `(user_id, cycle_id, book_id)`. The app currently hardcodes `user_id = 1` everywhere and looks up the most recent `reading_cycles` row for that user to determine the active `cycle_id`.

`schema.sql` uses `INSERT ... ON CONFLICT DO NOTHING` for the seed data, so re-running `initialize_database()` is safe.

## API endpoints

- `GET /api/books` — returns all 66 books with `chapters_read` for user 1's latest cycle
- `POST /api/progress` — body: `{ book_name, chapters_today }` — upserts progress, returns `{ success, chapters_read }`
