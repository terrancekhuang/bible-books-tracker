# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are the app's owner (Terrance Huang) plus a small circle of friends/family who also want to track their own Bible reading. Each user signs in with their own Google account and sees only their own progress, cycles, and stats — this is a small shared personal tool, not a public product being grown for discovery or acquisition.

## Product Purpose

Tracks progress through all 66 books of the Bible at chapter-level granularity: which chapters have been read, per book, across possibly multiple full read-throughs ("cycles"). Success for a user is being able to log a reading session in a few seconds, see accurate progress per book/testament/category, and stay motivated via streaks and a full-year activity heatmap.

## Positioning

The core mechanism, and the thing future design/build decisions should protect, is **chapter-level granularity plus streak/heatmap motivation** — not just "I read Genesis" but exactly which chapters, rolled up into segmented progress bars, multi-cycle history, and a GitHub-style activity heatmap. This is more precise than generic reading-plan apps (e.g. YouVersion) or a paper chart/spreadsheet, and is worth preserving even as the visual design evolves.

## Operating Context

- Users log chapters read per book, typically right after or during a reading session, often on mobile.
- A reading pass through the whole Bible is a "cycle"; users may run multiple cycles over time and want per-cycle history, not just a single lifetime total.
- Sessions frequently happen with poor or no connectivity, so writes must queue and sync later without data loss.
- Power users navigate primarily via keyboard (arrow/vim binds, `/` to search, chord shortcuts like `g d` / `g t` / `g p` to switch views) — this is a fast, keyboard-first logging tool, not just a stats viewer.
- Installable as a PWA for app-like access without an app store.

## Capabilities and Constraints

- Chapter-level progress tracking per book, aggregated into per-book, per-testament, and per-category views.
- Multiple reading cycles per user, each with its own progress and aggregate stats.
- Streaks (current/best), daily/weekly totals, and a 365-day activity heatmap.
- Filter/sort the book grid by testament, category, or status; sort by name, progress, or completion.
- Offline-first: failed writes queue in IndexedDB (`offlineQueue.ts`) and replay on reconnect; PWA caches `/api/*` with NetworkFirst/StaleWhileRevalidate.
- Auth is Google OAuth → backend-issued JWT; there is no invite/allowlist mechanism today — anyone with a Google account can currently sign up, even though the intended audience is a small circle. (Not asked to change; noted as current behavior.)
- Backend: Flask + psycopg2 + PostgreSQL; frontend: React 19 + TypeScript + Vite + Tailwind v4 + DaisyUI.

## Brand Commitments

No formal branding beyond the project name "Bible Books Tracker." No specific voice, tone, or visual identity has been declared as binding yet.

## Evidence on Hand

No user testimonials, case studies, or press exist, and none should be fabricated. The README (`README.md`) and `CLAUDE.md` document the current feature set and architecture and are reliable sources of current truth.

## Product Principles

1. **Logging speed over everything.** The primary loop (open app → find book → log chapters) must stay fast, keyboard-friendly, and forgiving of poor connectivity — never trade this for visual polish.
2. **Precision is the product.** Chapter-level (not book-level) tracking is the core differentiator; UI should always make it easy to see and log at that granularity.
3. **No ads, no third-party tracking.** This is a small personal/shared tool, not a monetized product — keep it free of advertising and analytics/tracking beyond what running the service requires.
4. **Offline is a hard requirement, not a nice-to-have.** Any feature must degrade gracefully without a connection and sync cleanly when it returns.
5. **Small, trusted audience.** Design for a handful of known users (owner + friends/family) rather than for anonymous public growth or self-serve onboarding at scale.

## Accessibility & Inclusion

No specific accessibility requirement has been established beyond normal good practice.
