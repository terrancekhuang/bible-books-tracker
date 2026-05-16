# Bible Books Tracker

Track your progress through all 66 books of the Bible — chapters read, reading streaks, activity history, and more.

**Live Website -> [https://bible.terrancehuang.dev/](https://bible.terrancehuang.dev/)**

<!-- Replace with an actual screenshot: -->
<!-- ![App screenshot](./public/screenshot.png) -->

---

## Features

- **Chapter-level progress** — log individual chapters per book; segmented progress bars show exactly what's been read
- **Activity heatmap** — GitHub-style calendar showing a full year of reading activity
- **Streaks & stats** — current streak, best streak, daily/weekly totals, and per-cycle summaries
- **Multiple reading cycles** — track each time through the Bible separately
- **Filter & sort** — filter by Testament, category, or status; sort by name, progress, or completion
- **Offline / PWA** — installable as a standalone app; chapter logs queue in IndexedDB and sync when back online
- **Dark mode** — follows system preference with a manual toggle
- **Keyboard navigation** — arrow-key grid navigation and vim keybinds

---

## Tech Stack

| Layer      | Stack                                                |
| ---------- | ---------------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS v4, DaisyUI |
| Auth       | Google OAuth 2.0 + JWT                               |
| Backend    | Python Flask, psycopg2                               |
| Database   | PostgreSQL                                           |
| Dev infra  | Docker Compose                                       |
| Deployment | Vercel (frontend)                                    |

---

## Getting Started

### 1. Database

```bash
docker compose up -d   # PostgreSQL on port 5432; schema + seed data load automatically
```

Or use the Homebrew setup script:

```bash
bash scripts/setup_db.sh
```

### 2. Backend

```bash
python backend/src/routes.py   # Flask on port 5001
```

> **macOS note:** AirPlay Receiver occupies port 5000, so Flask runs on 5001.

### 3. Frontend

```bash
npm install
npm run dev   # Vite dev server on http://localhost:3000
```

The Vite dev server proxies `/api/*` to `http://localhost:5001` automatically.

---

## API Reference

| Method | Path                 | Description                                         |
| ------ | -------------------- | --------------------------------------------------- |
| `POST` | `/auth/google`       | Verify Google OAuth token, create/return user       |
| `GET`  | `/auth/me`           | Current user profile (JWT required)                 |
| `GET`  | `/api/books`         | All 66 books with chapter progress for active cycle |
| `POST` | `/api/progress`      | Log chapters read `{ book_name, chapters }`         |
| `POST` | `/api/progress/undo` | Undo the last log entry for a book                  |
| `GET`  | `/api/cycles`        | All reading cycles with aggregate stats             |
| `POST` | `/api/cycles`        | Create a new reading cycle                          |
| `GET`  | `/api/activity`      | Last 365 days of activity (for heatmap)             |
| `GET`  | `/api/stats`         | Streaks, daily/weekly totals                        |

---

## License

MIT
