# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Full-stack Bible reading progress tracker:

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + DaisyUI, served on port 3000
- **Backend**: Python Flask + psycopg2, served on port 5001 (macOS AirPlay occupies 5000)
- **Database**: PostgreSQL (`bible-books-tracker` db, user `postgres`, password `pass`, localhost:5432)

Vite dev server proxies both `/api/*` and `/auth/*` to `http://localhost:5001`.

## Running the project

**Database** (one-time setup):
```bash
docker compose up -d          # PostgreSQL on 5432; schema + seed load on first run
# or: bash scripts/setup_db.sh  (local Homebrew postgres)
```

**Frontend** (from repo root):
```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # tsc + vite build
npm run lint     # eslint
```

**Backend** (from repo root):
```bash
python backend/src/routes.py   # Flask on port 5001; runs initialize_database() on startup
```

Run the backend from the project root — it reads `backend/src/schema.sql` relative to cwd.

## Environment variables

Create `.env` in the project root:
```
GOOGLE_CLIENT_ID=...
JWT_SECRET_KEY=...
DATABASE_URL=postgresql://postgres:pass@localhost:5432/bible-books-tracker
```

Create `frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=...      # same value as GOOGLE_CLIENT_ID, exposed to Vite
```

## Database schema

Six tables:

| Table | Purpose |
|-------|---------|
| `bible_books` | Static seed — 66 books with testament/category/num_chapters |
| `users` | Google OAuth users (google_id, email, name, picture_url) |
| `reading_cycles` | Per-user cycles (cycle_number, unique per user) |
| `progress` | Chapters read per (user_id, cycle_id, book_id) |
| `reading_log` | Timestamped entries (user_id, logged_at TIMESTAMPTZ, chapters_count) — powers the heatmap |
| `chapter_progress` | Granular per-chapter tracking (user_id, cycle_id, book_id, chapter_number, logged_at) |

The app hardcodes `user_id = 1` and uses the most recent `reading_cycles` row as the active cycle. `schema.sql` uses `INSERT ... ON CONFLICT DO NOTHING` so `initialize_database()` is safe to re-run.

## API endpoints

**Auth** (no JWT required on POST):
- `POST /auth/google` — verify Google credential token, upsert user, return JWT
- `GET /auth/me` — return current user (name, email, picture_url)

**Books & progress** (all require JWT):
- `GET /api/books` — 66 books with `chapters_read` + `chapters_read_list` for active cycle
- `POST /api/progress` — body: `{ book_name, chapters }` — upserts progress, returns `{ success, chapters_read, newly_logged, chapters_read_list }`
- `POST /api/progress/undo` — body: `{ book_name }` — removes the latest logged entry for a book

**Cycles & stats**:
- `GET /api/cycles` — all cycles for the user with aggregate stats
- `POST /api/cycles` — create a new cycle (auto-increments cycle_number)
- `GET /api/activity` — last 365 days of activity for the heatmap
- `GET /api/stats?tz_offset=N` — streaks, chapters today/this week, total days/chapters

## Authentication flow

1. Frontend (`@react-oauth/google`) sends the Google credential to `POST /auth/google`
2. Backend verifies it with Google using `GOOGLE_CLIENT_ID`, upserts the user row, returns a JWT
3. JWT is stored in `localStorage` as `app_jwt` and sent as `Authorization: Bearer {token}`
4. `frontend/src/lib/auth.ts` exports `getToken()` and `authHeaders()` — used everywhere

## Offline support

`frontend/src/lib/offlineQueue.ts` — IndexedDB write-ahead queue (`bible-tracker-offline` / `pending-writes`):
- Failed `/api/progress` writes are stored via `enqueueWrite()`
- On reconnect, `flushQueue(onLogout)` replays them in order then refetches books
- `getPendingCount()` drives the "Syncing N pending changes…" banner in Tracker

## PWA

Configured via `VitePWA` in `vite.config.ts`. Workbox uses NetworkFirst for `/api/*` (5 s timeout). On update the app prompts the user to reload.

## Keyboard shortcuts (Tracker)

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `←→↑↓` / `h j k l` | Navigate book grid |
| `gg` / `G` | First / last book |
| `Tab` or `i` | Focus chapter input |
| `Enter` | Submit progress |
| `u` | Undo last entry |
| `p` | Go to Profile |
| `Esc` | Deselect / clear search |
| `?` | Toggle help modal |

## Deployment (Vercel)

`vercel.json` rewrites `/api/*` and `/auth/*` to `api/index.py`, which imports the Flask app from `backend/src/routes.py` as a serverless function. The frontend builds to `dist/`.
