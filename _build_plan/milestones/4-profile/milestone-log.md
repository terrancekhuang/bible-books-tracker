# Milestone 4 — Profile

## What's new in the app

- **Profile is now a leaf too** — the same cream paper, red rule, and gilt-topped material as
  Dashboard, instead of the old white glass cards.
- **Your name, email and avatar sit inside a framed "bookplate"** at the top of the page — a
  double-ruled panel under a small "This Volume Belongs To" caption, echoing a nameplate glued
  into the front of a book.
- **Lifetime figures — best streak, total chapters, reading days, average pace — read as
  marginalia** across the top of the leaf, the same figure style Dashboard uses.
- **A weekly goal control**, editable in place exactly like Dashboard's, so you don't have to
  visit Dashboard just to change how many chapters you're aiming for.
- **Achievements are gilt-and-blind medallions, not emoji badges.** All thirteen achievements
  always show — earned ones keep their tooled bronze/silver/gold/rainbow ring, unearned ones are
  a blind-stamped impression — and every medallion's criteria ("Read 100 days in a row," etc.) is
  always readable underneath, so an unearned one still tells you what to do.
- **Current cycle progress, Start New Cycle, and Cycle History** all read the same, just retoned
  to the leaf's paper-and-gilt materials; the confirmation dialog for starting a new cycle is now
  a small leaf panel instead of a frosted-glass card.
- **A reader with nothing logged yet** sees the full achievement roster blind-stamped (which *is*
  the empty state) and "No earlier cycles yet — complete this one to start your history." instead
  of an empty gap.

## What was built

- **`frontend/src/lib/leafSurface.ts`** (new) — extracted the paper/red-rule/shadow recipe that
  `ContentsLeaf.tsx` and `Dashboard.tsx` each had inline into one `leafSurfaceStyle(topBorderColor)`.
  All three leaf surfaces (Tracker's contents leaf, Dashboard, and now Profile) use this; padding/
  margin stay page-specific.
- **`frontend/src/components/LeafDivider.tsx`** and **`LeafSectionLabel.tsx`** (new) — promoted
  out of `Dashboard.tsx`'s local definitions so Profile doesn't redefine them. Dashboard now
  imports these instead of its own copies (no visual change).
- **`frontend/src/components/LeafMarginaliaItem.tsx`** (new) — extracted Dashboard's marginalia
  column (icon + label + value, or `children` for an edit-in-place form, with the responsive
  `border-t`/`md:border-l` divider) into one shared component. Dashboard's marginalia row was
  refactored onto it; Profile's lifetime-figures row uses it directly.
- **`frontend/src/lib/achievements.ts`** (new) — `getAchievements(stats, cycles)`, pure logic
  ported from Profile's old inline thresholds, now returning all thirteen achievements every time
  (each with `earned: boolean` and new always-visible `criteria` copy) instead of filtering
  unearned ones out. Unit-tested in `frontend/src/lib/__tests__/achievements.test.ts` (8 tests —
  threshold boundaries, the completed-cycles counting rule, and the fixed roster order).
- **`frontend/src/components/AchievementMedallion.tsx`** (new, replaces the inline
  `AchievementBadge` that used to live in `Profile.tsx`) — earned medallions keep the existing
  tier ring/glow gradients (bronze/silver/gold/rainbow, unchanged) with an SVG icon from
  `Icons.tsx` in place of an emoji; unearned medallions render a uniform blind-stamped circle
  (paper-toned, inset emboss shadow, faint ink ring, dim icon) — no tier colour, since a tier only
  ever applies to something actually earned.
- **`frontend/src/Profile.tsx`** — full rewrite as one leaf: bookplate → lifetime-figures
  marginalia → weekly goal → achievements (13 medallions) → current cycle progress → Start New
  Cycle button → cycle history (`DashboardEntryRow`, reused from milestone 3 exactly as its own
  log flagged). The confirmation `<dialog>` keeps its native-`<dialog>` + `cycle-dialog` CSS shell
  from milestone 1, but its inner panel is now a small `leafSurfaceStyle(GILT)` card with gilt-
  toned action buttons instead of the frosted-glass one.
- **`frontend/src/lib/queries.ts`** — added `SettingsData`, `settingsQueryOptions`, and
  `useSettingsQuery()` (`GET /api/settings`), mirroring the existing query-hook pattern exactly.
  This is the first frontend caller of an endpoint the backend already served.
  **`frontend/src/lib/queryKeys.ts`** gained a `settings()` key.
- **`frontend/src/lib/dashboardMutations.ts`** — `createUpdateWeeklyGoalMutationOptions` now
  optimistically writes (and rolls back, and invalidates) the `settings` cache alongside the
  existing `dashboard` cache, so Dashboard's and Profile's weekly-goal editors share one mutation
  and stay in sync. `frontend/src/lib/__tests__/dashboardMutations.test.ts` gained tests for the
  settings-cache write, rollback, and invalidation (10 tests total, up from 7).

## Decisions made during implementation

All confirmed with the user before building:

- **Reading Rhythm was not added to Profile** — it stays on Dashboard only, a deliberate deviation
  from the PRD's stated scope for this milestone (see below).
- **Achievement tiers were kept** (bronze/silver/gold/rainbow) rather than collapsed to a literal
  two-state gold/blind system. Unearned achievements are uniformly blind regardless of what tier
  they'd be if earned; the always-visible criteria caption is what satisfies "an unearned one
  still tells you what to do," not tier removal.
- **Profile is one continuous leaf**, matching Dashboard's structure, with identity as a framed
  bookplate panel rather than a separate card or a different page material entirely (e.g. a
  cloth board like Login's).
- **Profile's weekly goal editor is backed by a new dedicated `useSettingsQuery`**, not by also
  calling `useDashboardQuery` for the one field it needed — keeps Profile from pulling in
  Dashboard's whole payload (stats, activity, user) just to read `weekly_goal`.

## Anything the next milestone will need to know

- **`leafSurfaceStyle`, `LeafDivider`, `LeafSectionLabel`, and `LeafMarginaliaItem` are now the
  shared vocabulary for any future leaf-styled page or section** — reach for these instead of
  re-inlining the paper/rule/divider/marginalia patterns a fourth time.
- **`getAchievements` and `AchievementMedallion` are fully decoupled from `Profile.tsx`** if a
  future milestone wants achievements surfaced elsewhere (e.g. a Dashboard teaser).
- **`GET /api/settings` now has a real frontend caller** (`useSettingsQuery`), and the weekly-goal
  mutation writes to both the `dashboard` and `settings` caches — if a third page ever needs the
  weekly goal, wire it through `useSettingsQuery`, not a fresh dashboard fetch.

## Deviations from the PRD

- **Reading Rhythm is not on Profile**, though the PRD's "What gets built" list for this milestone
  includes "Reading rhythm by weekday and by part of day, across both windows." The user
  explicitly chose to keep it Dashboard-only when asked directly during planning (milestone 3's
  log had flagged this exact question as open). The PRD's "Done when" checklist for this milestone
  does not separately require rhythm, so this is a scoped, confirmed omission rather than a missed
  requirement.
- **Achievement tiers were kept**, not collapsed to the PRD's literal "gold when earned, blind
  when not" two-state wording — a confirmed user choice (see decisions above).
