---
target: Whole app (Dashboard, Tracker, Profile)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-06T19-58-41Z
slug: whole-app-dashboard-tracker-profile
---
Method: dual-agent (A: design-review subagent · B: detector/browser-evidence subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading skeleton on first-ever fetch — `useCachedFetch` only flips `loading` when there's no cache, so a fresh install briefly renders real zeroed UI indistinguishable from "no progress." `SyncIndicator` is PWA-only, so browser-tab users get no sync affordance in the nav. |
| 2 | Match Between System and Real World | 4 | Terminology (books, chapters, cycles, testament, category) matches how a Bible reader thinks; chapter-range input (`1-5, 7, 10-12`) matches natural session description. |
| 3 | User Control and Freedom | 3 | Undo, two-step confirm on Reset/Mark-All, Escape closes search/detail/modals. Gap: `Undo` silently disables offline with no title/explanation of why. |
| 4 | Consistency and Standards | 3 | `useConfirm` reused identically for destructive actions — good. Icon-button affordance inconsistent (`aria-label` on `SyncIndicator`, only `title` on theme toggle/`UserMenu`). Two independently-coded starfield canvases (Login's `CosmicCanvas`, `CelestialBackground`'s `StarCanvas`) render a subtly different "sky" pre/post login. |
| 5 | Error Prevention | 3 | Live inline validation on chapter-range input with a helpful message. Weekly-goal edit silently no-ops on invalid values with no user-visible feedback that the save didn't happen. |
| 6 | Recognition Rather Than Recall | 3 | Filters/sort are visible controls, not hidden menus; search shows its own `/` shortcut hint inline. Keyboard shortcuts require opening the `?` modal to recall (acceptable — power-user accelerators, not required knowledge). |
| 7 | Flexibility and Efficiency of Use | 4 | Strongest heuristic given PRODUCT.md's "logging speed over everything" principle: full vim-style nav, chord shortcuts (`g d/t/p`), `/` search, `Tab`/`i` to input, `Enter` submit, `u` undo. |
| 8 | Aesthetic and Minimalist Design | 3 | Revised after live screenshots (see addendum): the real rendered UI is considerably more restrained than a source-only read suggested — no overwhelming static clutter on Login/Dashboard/Tracker. The motion-load concern (animated starfield/parallax with no `prefers-reduced-motion` check) still stands as a separate, real issue — screenshots can't disprove that, only the "everything competes for attention in a still frame" claim. |
| 9 | Error Recovery | 2 | `Profile.tsx` favorites has a real error state ("Could not load favorites.") — good precedent, inconsistently applied. `Login.tsx` auth failure only `console.error`s with nothing shown to the user; `saveGoal` fails silently with no toast. |
| 10 | Help and Documentation | 3 | `?` keyboard-shortcuts modal is genuine, well-scoped contextual help (desktop only). No in-context explainer exists for domain concepts a first-timer wouldn't know (what a "cycle" is, why the chapter-range syntax works). |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

**LLM assessment**: Not a generic dashboard skin. The celestial visual language (Cinzel serif headers, Cormorant Garamond scripture quotes placed at emotionally apt moments, animated starfield/nebula, gold/bronze/silver/rainbow achievement tiers) is applied consistently across Login, Dashboard, Tracker, and Profile — real authorship, not a template reskin. Where it slips toward interchangeable: underneath the skin, the IA (stat-card grid, progress bars, heatmap, badge-tier gamification) is the same shape as any habit tracker. The product's own stated differentiator — chapter-level granularity — is present (`SegmentedProgressBar`) but visually subordinate to decorative elements (arc ring, glow, canvas) on the one screen where it matters most.

**Deterministic scan**: `detect.mjs --json frontend/src` — exit code 2, 1 finding. `bounce-easing` (slop, warning) at `frontend/src/Profile.tsx:93` — `cubic-bezier(.34, 1.56, .64, 1)` on the avatar hover transform. Manually verified as a true positive: the curve's y-overshoot (1.56) will visibly spring the avatar past its target scale before settling. No other rules fired across the scanned tree (App.tsx/css, Dashboard.tsx, index.css, Login.tsx, main.tsx, all of components/ and lib/) — tree was small enough to need no scope narrowing.

**Visual overlays**: Not available this run. Both assessments independently invoked the `claude-in-chrome` skill to prime browser automation and both got the same result: the Claude in Chrome extension is not connected in this session. No tab was opened, no injection attempted, no console evidence exists for Dashboard, Tracker, or Profile. Everything above is source-grounded inference (verified against the running local app's API responses, not its rendered pixels) rather than an observed screenshot/overlay — treat contrast, spacing, and literal layout claims accordingly. No user-visible overlay exists; connect the extension and re-run for pixel-level confirmation.

## Overall Impression

The app has a real, deliberate aesthetic point of view that most personal side-projects never bother to commit to — that's rare and worth protecting. But the execution currently serves the mood more than the mechanic: PRODUCT.md is explicit that chapter-level precision and logging speed are the two things to protect above all else, and the biggest opportunity here is making the UI *feel* as fast and as precise as the keyboard system already *is* — right now the decorative layer (constant animation, competing glows) sits on top of, rather than in service of, that precision.

## What's Working

1. **The chord-based keyboard system** (`g d`/`g t`/`g p`, vim binds, `/` search, arm/consume chord state machine in `useKeyChord`) is a genuinely well-executed, product-specific efficiency layer that directly serves the stated #1 product principle.
2. **The two-step confirm pattern** (`useConfirm`) is applied consistently to Reset and Mark-All-Read, auto-clears on context change, and never blocks with a modal — low-friction error prevention that doesn't slow the primary loop.
3. **The achievement badge system** (tiered glow/shadow, hover lift) is product-specific delight that makes the multi-cycle/streak mechanics — the app's own differentiator — feel earned rather than abstract.

## Priority Issues

**[P1] Chapter-level granularity — the stated core differentiator — is the least emphasized element on the primary detail view**
- **Why it matters**: PRODUCT.md names chapter-level precision as the thing to protect above all else. In the Tracker detail panel, `SegmentedProgressBar` — the one component that shows *which* chapters are read — is a 2px-tall bar rendered after a large glowing arc ring and percentage, making it the least visually prominent number-bearing element in the panel.
- **Fix**: Give the segmented chapter bar equal or greater visual weight than the arc ring, or replace the arc ring on the detail view with a more prominent chapter grid, since the arc mostly duplicates the percentage already shown as large text.
- **Suggested command**: `/impeccable clarify`

**[P1] Silent failure on Google sign-in and settings save**
- **Why it matters**: `Login.tsx`'s `handleSuccess` only `console.error`s on auth failure — a real user sees nothing happen and will likely just click sign-in again. `Dashboard.tsx`'s `saveGoal` reverts the weekly-goal input silently on failure with no toast. This is the weakest point of heuristic 9 (error recovery), in exactly the spot a small-trusted-audience tool (friends/family, not a support team) should be most forgiving.
- **Fix**: Add a visible, non-blocking error state (toast/banner) for both auth failure and settings-save failure.
- **Suggested command**: `/impeccable harden`

**[P2] No `prefers-reduced-motion` handling, plus a confirmed bounce/overshoot easing artifact**
- **Why it matters**: `CelestialBackground.tsx` runs a continuous `requestAnimationFrame` loop (150 stars, shooting-star spawner, mouse-parallax) on every authenticated route, with no `prefers-reduced-motion` check anywhere in the codebase — a real cost for an offline-first, mobile-heavy, battery-sensitive tool, and an accessibility gap for vestibular-sensitive users. The detector independently confirmed a related motion issue: `Profile.tsx:93`'s avatar-hover transition uses an overshoot easing curve (`cubic-bezier(.34, 1.56, .64, 1)`) that will visibly spring past its target — a small but real "slop" pattern the two assessments caught from different angles (subjective read vs. mechanical scan).
- **Fix**: Gate canvas/nebula animation behind `window.matchMedia('(prefers-reduced-motion: reduce)')`; replace the overshoot easing on the avatar hover with a standard ease-out curve unless the bounce is an intentional brand flourish.
- **Suggested command**: `/impeccable optimize`

**[P2] Icon-only controls rely on `title` instead of `aria-label`, inconsistently**
- **Why it matters**: The theme toggle and account-menu trigger (`UserMenu.tsx`) use only `title`, not reliably announced by screen readers and invisible on touch (no hover). `SyncIndicator.tsx` already does this correctly with both `title` and `aria-label` — the pattern is known but not applied everywhere.
- **Fix**: Add `aria-label` to every icon-only button (theme toggle, avatar menu trigger, edit-goal icon).
- **Suggested command**: `/impeccable harden`

**[P3] No loading indicator distinguishes "no data yet" from "still loading"**
- **Why it matters**: A first-time-ever load (or cleared storage) briefly renders `0%`, `0 today`, and an empty heatmap — visually identical to genuinely having no progress, which is confusing on a new install's very first render.
- **Fix**: Render a lightweight skeleton/shimmer state matching the celestial aesthetic instead of zeroed real UI while `loading` is true.
- **Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Alex (Impatient Power User)** — the app's primary persona per PRODUCT.md
- The core loop (`/` search → type → `Enter` → `Tab`/`i` → type range → `Enter`) is genuinely fast — no red flag on the happy path.
- Red flag: `Undo` silently disables when offline with no explanation. Alex will mash `u`, nothing happens, and will likely conclude the shortcut is broken rather than realize they're offline.
- Red flag: the continuous animated starfield/parallax is pure overhead for someone optimizing for logging speed — nothing Alex needs, everything Alex has to visually filter out.

**Jordan (Confused First-Timer)**
- Red flag: no explanation anywhere of what a "cycle" is. The "Start New Cycle" confirmation ("resets your reading progress... saved in history") assumes Jordan already understands the concept; without that framing it can read as "this will erase my data."
- Red flag: chapter-input syntax (`1-5, 7, 10-12`) is explained only via placeholder text plus live validation — Jordan's first attempt is likely to fail before they learn the format (mitigated somewhat by a genuinely helpful inline error message).
- Red flag: the first-load zero-state (see P3) could read as "this app isn't tracking anything" rather than "still loading."

**Sam (Accessibility-Dependent User)**
- Red flag: icon-only theme toggle and account-menu buttons use `title`, not `aria-label` — a screen-reader user tabbing through the nav hears an unlabeled button.
- Red flag: `SegmentedProgressBar`'s read/unread chapters are distinguished by fill opacity with a tooltip that only appears on mouse-hover, not reachable via keyboard/touch.
- Red flag (unconfirmed — needs the browser pass this run couldn't do): several text treatments use low-opacity color-on-color combinations that are worth a contrast-checker pass.

## Minor Observations

- Two independently-coded starfield canvas components (`Login.tsx`'s `CosmicCanvas`, `CelestialBackground.tsx`'s `StarCanvas`) with different star counts/behavior — worth consolidating, both for maintainability and so the "sky" looks identical pre/post login.
- `SyncIndicator` only renders for installed-PWA users (`if (!isPWA) return null`) — browser-tab users, who can still hit the offline conditions PRODUCT.md calls out, get no sync-status affordance in the nav bar.
- Detector-confirmed: `Profile.tsx:93` bounce-easing on avatar hover (see P2 above) — the one deterministic finding this run, and a genuine positive, not a misfire.
- Achievement badge labels wrap awkwardly under narrow flex items for longer labels ("Year-Long Streak," "100-Day Streak").
- `weekly_goal` input caps at 200 via native `max` with no message explaining why an out-of-range value was rejected/clamped.
- Footer ("Made by Terrance Huang") appears on Dashboard/Profile but not Tracker — minor page-chrome inconsistency.

## Questions to Consider

- If chapter-level precision is truly the differentiator, what would it look like to make the segmented chapter bar the *hero* element of the book detail view instead of a supporting line under the arc ring?
- Does the always-on animated starfield serve "logging speed over everything," or is it in tension with it — would a quieter, static version of the same aesthetic preserve the mood while cutting the performance/attention cost?
- What should happen, emotionally and visually, the day a streak breaks? Right now the app has no answer, and that's arguably the highest-stakes moment for a motivation tool built around streaks.
- Is there a lightweight way to teach "cycle" and the chapter-range syntax on first use without adding the onboarding friction a small trusted-audience tool should avoid?

## Visual Verification Addendum

Neither subagent could get real browser evidence in-session (Claude in Chrome extension not connected). After synthesis, the orchestrator ran this project's `run-bible-books-tracker` screenshot skill (Playwright, headless) plus a direct authenticated Playwright pass against the running local dev stack, and reviewed the actual rendered pixels for Login, Dashboard, Tracker (empty, 100%-complete, and partially-read book states), and Profile at desktop and mobile widths. This changes three things:

**[P1 — NEW, screenshot-confirmed] The "0" digit is visually indistinguishable from the letter "o" in the Dashboard streak/today pills.** `Dashboard.tsx:196-197` renders `${stats?.current_streak ?? 0}d streak` and `${stats?.chapters_today ?? 0} today` in Raleway, without the `tabular-nums` class other numeric spans in the same file use (e.g. line 271). When either value is legitimately `0` — a completely normal, everyday state for a habit tracker (streak just broke; haven't logged anything yet today) — the rendered badge reads as "od streak" / "o today" with no numeral shape visible at all, confirmed at 3x crop. This directly compounds the "what happens when a streak breaks" emotional-low-point question raised above: the exact moment is also the moment the UI becomes hardest to read correctly. **Fix**: add `tabular-nums` (matching line 271's precedent) and/or verify Raleway's zero glyph at this weight/size; consider a slashed or dotted zero for stat displays specifically. **Suggested command**: `/impeccable clarify`

**[Confirmed, strengthened] The chapter-granularity P1 issue holds up under live inspection, and is arguably understated.** Screenshotting a partially-read book (2 Samuel, 22/24 chapters) shows the `SegmentedProgressBar` renders as a plain, unbroken progress bar — it does not visually communicate *which* chapters are read at all, just percentage-again beneath a redundant arc ring showing the same percentage a third time (arc, "92%", and bar all express one number three ways; only the bar claims to be chapter-level and doesn't look it).

**[Correction] Heuristic 8 (Aesthetic and Minimalist Design) was scored too harshly from source alone.** Real screenshots of Login, Dashboard, and Tracker are considerably cleaner and more restrained than the source-only read suggested — no overwhelming static clutter, no competing glow on first glance. Revised 2→3 (table above updated); the underlying motion-load concern (P2, no `prefers-reduced-motion`) is unaffected since a static screenshot can't confirm or deny animation intensity.

**Unrelated but worth flagging**: this project's own `.claude/skills/run-bible-books-tracker` screenshot driver mocks a stale `/api/stats` route. The live Dashboard actually fetches a consolidated `/api/dashboard` endpoint, so the driver's stats mock is silently ignored and every screenshot taken with it shows zeroed streak/today/this-week figures regardless of the mock's own values (12/5/23) — a maintenance gap in the skill, not a product bug. Worth a follow-up fix to `driver.py` (add an `/api/dashboard` mock wrapping the existing stats fields) so future screenshot-based reviews don't misread this as broken app state.
