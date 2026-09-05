# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Full-stack Bible reading progress tracker:

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Python Flask + psycopg2 + gunicorn
- **Database**: PostgreSQL 17 (self-hosted in Docker)
- **Infra**: Hetzner Cloud VM (`cpx22`, `nbg1`), Terraform, host nginx + Let's Encrypt
- **CI/CD**: GitHub Actions — lint/build/test on every push and PR; rsync + SSH deploy on `master` once they pass
- **Live URL**: `https://bible.terrancehuang.dev` (server IP: `5.78.233.181`)

### Backend modules (`backend/src/`)

| Module | Owns |
|--------|------|
| `routes.py` | HTTP only — auth, parse, delegate, serialise |
| `reading_history.py` | Activity, stats and rhythm. Takes `(user_id, tz_offset)`, opens its own cursor |
| `db.py` | The connection pool and the `db_cursor()` context manager |
| `config.py` | Environment |

Route handlers never compute over reading history themselves. If a handler needs streaks,
heatmap data or rhythm, it calls `reading_history` — see the `tz_offset` note under
**API endpoints** for why that boundary matters.

## Local development

**Database**:
```bash
docker compose up -d   # PostgreSQL on 5432; schema + seed load on first run
```
If something is already listening on 5432 (e.g. a host-installed PostgreSQL), this fails with
"port already in use" — skip it and point `DATABASE_URL` at that instance instead. `make db`
detects this automatically and skips `docker compose` when 5432 is already reachable.

**Frontend** (from repo root):
```bash
npm run dev      # dev server on http://localhost:5173
npm run build    # tsc + vite build
npm run lint     # eslint
```

Vite proxies `/api/*` and `/auth/*` to `http://localhost:5001`.

**Backend** (from repo root):
```bash
backend/.venv/bin/python backend/src/routes.py   # Flask on port 5001
```

## Environment variables

### Local — `.env` in repo root:
```
GOOGLE_CLIENT_ID=...
JWT_SECRET_KEY=...
DATABASE_URL=postgresql://postgres:pass@localhost:5432/bible-books-tracker
FRONTEND_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=...   # same value as GOOGLE_CLIENT_ID, exposed to Vite at build time
```

This is the only local env file. Vite's project root is the repo root, so it reads
`./.env` and nothing else — a `frontend/.env` is never loaded.

### Production — `/srv/apps/bible-books-tracker/.env` on server:
```
GOOGLE_CLIENT_ID=...
JWT_SECRET_KEY=...
DATABASE_URL=postgresql://postgres:<password>@db:5432/bible-books-tracker
FRONTEND_URL=https://bible.terrancehuang.dev
POSTGRES_PASSWORD=...
VITE_GOOGLE_CLIENT_ID=...   # baked into frontend bundle at Docker build time — must be present
BACKUP_S3_ACCESS_KEY=...    # Cloudflare R2 credentials — R2 → Manage R2 API Tokens in CF dashboard
BACKUP_S3_SECRET_KEY=...
BACKUP_S3_ENDPOINT=...      # from `terraform output backup_s3_endpoint`
BACKUP_S3_BUCKET=...        # from `terraform output backup_bucket_name`
```

`VITE_GOOGLE_CLIENT_ID` is a Vite build-time variable. It gets embedded in the JS bundle when the frontend Docker image is built. Changing it requires rebuilding the frontend container.

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | Runs | Environment |
|-----|------|-------------|
| `frontend` | `npm run lint`, `npm run build`, `npm test` | Node 20 — matches `frontend/Dockerfile` |
| `backend` | `pytest backend/tests` | Python 3.11 + a `postgres:17` service — matches `backend/Dockerfile` and `docker-compose.prod.yml` |
| `deploy` | rsync + `docker compose up -d --build` + nginx reload | only on a push to `master`, and only if both test jobs passed |

The backend suite needs a real database — `conftest.py` loads `schema.sql` into it once per
session — which is why CI runs a Postgres service container rather than mocking.

`make test` runs the same two suites locally. Test-only dependencies live in
`backend/requirements-dev.txt`, which pulls in the pinned production set and adds pytest;
the production image installs `backend/requirements.txt` alone, so pytest never ships.

Concurrency is per-ref. On `master` runs queue rather than cancel — overlapping deploys race
on `docker compose up` and a cancelled one can leave the server mid-recreate. On every other
ref a superseded run is cancelled.

The deploy step itself:
1. rsyncs the repo to `/srv/apps/bible-books-tracker/` on the server (excluding `.env`, `.git`, `node_modules`, Terraform state)
2. SSHs in and runs `docker compose -f docker-compose.prod.yml up -d --build`
3. Reloads nginx

**Manual deploy / debugging**:
```bash
ssh -i infra/deploy_key root@5.78.233.181
cd /srv/apps/bible-books-tracker
docker compose -f docker-compose.prod.yml up -d --build
docker logs app-backend-1 --tail 50
```

**GitHub Actions secrets required**: `SSH_PRIVATE_KEY`, `SERVER_IP`, `SERVER_USER`

## Production stack

`docker-compose.prod.yml` runs three containers:

| Container | Image | Port |
|-----------|-------|------|
| `app-db-1` | postgres:17 | internal only |
| `app-backend-1` | built from `backend/` | `127.0.0.1:5001` |
| `app-frontend-1` | built from repo root via `frontend/Dockerfile` | `127.0.0.1:3000` |

Host nginx (`/etc/nginx/sites-enabled/bible-tracker.conf`) proxies:
- `/api/*` and `/auth/*` → `127.0.0.1:5001` (backend)
- `/` → `127.0.0.1:3000` (frontend)

TLS via Let's Encrypt certbot (auto-renews via systemd timer).

**Frontend Docker build** uses the repo root as context (not `frontend/`) because all npm dependencies live in the root `package.json`.

There is exactly one frontend build config, and it is at the repo root: `package.json`,
`vite.config.ts`, `index.html`, `tsconfig*.json`, `eslint.config.js`, `public/`.
`frontend/` holds only `src/`, `Dockerfile` and `nginx.conf`. It used to carry a second,
diverged copy of every one of those files, left over from the original Vite scaffold and
built by nothing — don't recreate them.

## Infrastructure (Terraform)

```bash
cd infra
terraform init
terraform plan
terraform apply
```

State is local (`infra/terraform.tfstate` — gitignored). The deploy key is generated by Terraform and written to `infra/deploy_key` (gitignored, `0600`).

Required: `infra/terraform.tfvars` (gitignored):
```hcl
hcloud_token  = "..."
admin_ssh_key = "..."   # your personal public key for emergency access
```

## Database schema

Four tables:

| Table | Purpose |
|-------|---------|
| `bible_books` | Static seed — 66 books with testament/category/num_chapters |
| `users` | Google OAuth users (google_id, email, name, picture_url, weekly_goal) |
| `reading_cycles` | Per-user cycles (cycle_number, unique per user) |
| `chapter_progress` | Every chapter read: (user_id, cycle_id, book_id, chapter_number, logged_at) |

`chapter_progress` is the only progress table. It is the single source for the book
grid, the heatmap, streaks and rhythm alike — `progress` and `reading_log` were
superseded by it and are dropped at the end of `schema.sql`.

Schema is in `backend/src/schema.sql`. It's loaded automatically when the `db` container first initializes (via `docker-entrypoint-initdb.d`). Uses `INSERT ... ON CONFLICT DO NOTHING` for safe re-runs.

## API endpoints

**Auth** (no JWT required on POST):
- `POST /auth/google` — verify Google credential token, upsert user, return JWT
- `GET /auth/me` — return current user (name, email, picture_url)

**Books & progress** (all require JWT):
- `GET /api/books` — 66 books with `chapters_read` + `chapters_read_list` for active cycle
- `POST /api/progress` — body: `{ book_name, chapters }` — upserts progress, returns `{ success, chapters_read, newly_logged, chapters_read_list }`
- `POST /api/progress/undo` — body: `{ book_name }` — removes the latest logged entry for a book
- `POST /api/progress/reset` — body: `{ book_name }` — clears every chapter logged for a book in the active cycle

**Cycles & stats**:
- `GET /api/cycles` — all cycles for the user with aggregate stats
- `POST /api/cycles` — create a new cycle (auto-increments cycle_number)
- `GET /api/activity?tz_offset=N` — last 365 days of activity for the heatmap
- `GET /api/stats?tz_offset=N` — streaks, chapters today/this week, total days/chapters
- `GET /api/dashboard?tz_offset=N` — what Dashboard loads in one request: `stats`, `activity`, `weekly_goal` and the nav-bar `user` (name, picture_url)

**Settings**:
- `GET /api/settings` — `{ weekly_goal }`
- `PUT /api/settings` — body: `{ weekly_goal }` — must be a positive integer
- `GET /api/rhythm?tz_offset=N` — when the user reads: `by_weekday` (Monday-first, 7 entries), `by_part_of_day` (morning/afternoon/evening/night), `total_chapters` and `distinct_days`, returned for both an `all_time` and a `last_90_days` window in one payload

`tz_offset` is minutes east of UTC (`-getTimezoneOffset()`). Since `logged_at` is `TIMESTAMPTZ`,
any SQL that groups by local day or hour must pin the base to UTC first — otherwise Postgres
resolves the timestamp in the *session* timezone and `tz_offset` is applied on top of that shift.

That rule has exactly one definition: `reading_history.LOCAL_TS`. Don't retype the fragment —
interpolate it, and bind parameters **by name** (`%(tz)s`, `%(user)s`), which is what lets it
appear more than once in a query without positional bookkeeping.

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
| `←→` / `h l` | Switch volume |
| `↑↓` / `k j` | Navigate entries |
| `Tab` or `i` | Focus chapter input |
| `Enter` | Submit progress |
| `u` | Undo last entry |
| `R` | Reset all progress (two-step) |
| `A` | Mark all chapters as read (two-step) |
| `g` `h` | Go to Dashboard |
| `g` `t` | Go to Tracker |
| `g` `p` | Go to Profile |
| `Esc` | Deselect / clear search |
| `?` | Toggle help modal |

## `_build_plan/`

The `_build_plan/` folder contains the initial PRD and per-milestone prompts used to scaffold this codebase during its initial build-out phase. These files are **temporary** — they exist for documentation and guidance only. They are **not** functional: no code, configuration, or runtime logic in this codebase should import, reference, or depend on anything inside `_build_plan/`.

Do not treat `_build_plan/` as long-living documentation for the codebase. The codebase will evolve past the assumptions and decisions captured here. Once the initial milestones are complete, this folder is expected to be deleted.
