# Milestone 5 — Retire & polish

## What's new in the app

- **The Profile "Start a new cycle?" confirmation now opens centered on the screen.** It was
  previously appearing pinned to the top-left corner — a real bug, not a design choice — and is
  now fixed at every screen size.
- **A proper "page not found" screen** now appears if you land on a broken or mistyped link,
  instead of a blank page — styled to match the rest of the app, with a way back to Dashboard.
- **If your connection drops mid-load, Dashboard, Tracker, and Profile now tell you** ("Could not
  load…") with a Try Again button, instead of spinning forever or showing a blank page.
- **A few low-contrast text spots are easier to read now**: unearned achievement names and their
  requirements on Profile, and the "Made by Terrance Huang" credit on the Login page.
- **The "Add to Home Screen" install prompt no longer has leftover blue accents** from the old
  visual world — its step numbers and icons are now gold, matching everything else in the app.
- **Installing the app to your home screen now shows the right colors** in the OS-level app
  switcher and splash screen (previously still the old indigo/slate from before the redesign).
- Nothing else changed behaviorally — this milestone was cleanup and polish, not new features.

## What was built

- **Deleted dead code now that nothing renders it**: `frontend/src/components/CelestialBackground.tsx`
  (the old starfield/nebula canvas, unmounted since milestone 1), `frontend/src/lib/PreviewProvider.tsx`
  (an already-unused wrapper flagged for removal in milestone 1's log), and the entire
  `frontend/src/prototypes/` folder plus the root `prototypes.html` (11 files — the Volumes and
  Login design references, no longer needed as a live reference now that all four pages are built).
  Verified via full-repo grep before deleting that nothing else imported or linked to any of them.
- **Fixed the Profile dialog centering bug**: `dialog.cycle-dialog` in `frontend/src/index.css` now
  sets `margin: auto` explicitly. Root cause: Tailwind v4's Preflight resets `margin: 0` on every
  element, which silently defeats the native `<dialog>` element's built-in `margin: auto` centering;
  the existing rule already overrode padding/border/background but never re-added margin.
- **`vite.config.ts`**: PWA manifest `theme_color` and `background_color` updated from the old
  indigo/slate (`#4338ca` / `#f8fafc`) to shelf/leaf (`#2A231C` / `#F2ECDD`), matching what
  `index.html`'s `<meta name="theme-color">` was already updated to.
- **`frontend/src/components/PWAInstallModal.tsx`**: the step-number circles, `ShareIcon`, and
  `MenuIcon` were still the old celestial blue (`rgba(100,130,255,…)` / `#7ab8ff`); retoned to gilt.
- **`frontend/src/components/SyncIndicator.tsx`**: the "Syncing…" state's blue was retoned to the
  same amber already used for the "pending" state, so no celestial blue survives anywhere.
- **Error states added to Dashboard, Tracker, and Profile**, following the pattern
  `ReadingRhythm.tsx` already established (a plain leaf-styled message, no new component): each
  page now destructures `isError`/`refetch` from its query hook(s) and renders a "Could not load…"
  message with a Try Again button in place of its main content when a fetch fails. `queries.ts`
  needed no changes — every hook already returns the full `useQuery` result.
- **`frontend/src/NotFound.tsx`** (new): a leaf-styled 404 page reusing `leafSurfaceStyle`, wired
  as `<Route path="*" ...>` in `App.tsx`, gated behind `jwt` the same way every other route is
  (unauthenticated visitors are redirected to `/login` rather than seeing a 404).
- **Contrast fixes** (computed via actual WCAG relative-luminance, not eyeballed): unearned
  achievement label/criteria text in `AchievementMedallion.tsx` was ~2.7:1 / ~3.1:1 against the
  leaf background (both bumped from alpha 0.45/0.5 to 0.65, now ~4.5-4.8:1); the Login footer
  credit line was ~3.3:1 (bumped from alpha 0.4 to 0.55, now ~5:1). The unearned medallion's icon
  glyph itself was left at its low alpha — it's a decorative blind-stamp effect, not
  information-bearing text; the label and criteria beneath it already carry the meaning.
- **`CLAUDE.md`** updated: dropped the stale "DaisyUI" mention from the Architecture table (it was
  removed from the dependency tree back in milestone 1), and replaced the stale keyboard-shortcuts
  table (which still listed removed `gg`/`G` and was missing `R`/`A`) with what `App.tsx`'s help
  modal and `Tracker.tsx` actually implement today.
- **Verified via screenshots** (Playwright, mocked API, both mobile ~390px and desktop viewports):
  Login, Dashboard, Tracker, Profile (including the achievement medallions wrapping cleanly at
  phone width), the dialog fix at both widths, and the new NotFound page at both widths.

## Decisions made during implementation

- **The `SyncIndicator`'s "Syncing…" blue was retoned to match the existing amber "pending" color**
  rather than to gilt or a new color — it's a status color family (green/amber/red) that was
  already mostly-consistent; only the syncing state's blue was a celestial leftover.
- **The not-found route stays behind the same `jwt` gate as every other route** (redirects to
  `/login` if signed out) rather than being publicly visible, matching the existing routing pattern
  in `App.tsx` rather than introducing a new exception to it.
- **Error states show one message per page, not per-section** — Dashboard and Profile each combine
  multiple query hooks into a single `isError` check with one retry button, since the failing
  queries all feed the same page and a per-section message would be more granular than useful.

## Anything the next milestone will need to know

- There is no "next milestone" — this was the last one in the PRD. The Volumes redesign is
  complete across Login, Dashboard, Tracker, and Profile.
- `_build_plan/` itself was intentionally left in place — its own note says it's deleted once the
  initial milestones are "built and shipped," which is a separate decision from this milestone's
  scope.

## Deviations from the PRD

- **The theme-preference-clearing step was a no-op.** The PRD's "what gets built" list mentions
  "the stored theme preference cleared," but milestone 1 had already fully removed the theme system
  — no `ThemeContext`, `isDark`, or theme `localStorage` key exists anywhere in `frontend/src`. There
  was nothing left to clear.
- **A dialog-centering bug fix was added that wasn't in the PRD's scope list.** The user reported
  (with a screenshot) that Profile's "Start a new cycle?" confirmation rendered pinned to the
  top-left corner instead of centered. Since this milestone is explicitly the polish pass and the
  bug lives in the exact dialog the PRD's milestone 4 introduced, it was fixed here rather than
  deferred with no future milestone to catch it.
