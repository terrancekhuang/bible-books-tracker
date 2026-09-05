# Milestone 3 — Dashboard

## What's new in the app

- **Dashboard is now an opened register leaf** — one continuous page of cream laid paper with a
  gilt top edge and a red double rule under the day's greeting, instead of a stack of separate
  white cards.
- **Overall progress reads as plain figures**, not a ring: "799 of 1,189 chapters · 23 of 66
  books complete," right under the day's heading.
- **Streak, today's chapters, and your weekly goal now sit side by side as marginalia** at the
  top of the leaf. The weekly goal is still editable right there — pencil icon, inline number
  field, same save/error behaviour as before.
- **The activity calendar is now a pricked calendar in gilt** — each day is a small dot: an
  empty pinprick outline for nothing logged, a gilt dot that grows and deepens the more you
  read that day. Tapping a day on a touch device still shows its date and chapter count; hovering
  still shows the same on desktop.
- **Continue Reading, Testament Progress, and Category Progress are now ruled entries** — a book
  or category name, a leader-dot line, a trailing figure, and a coloured progress rule underneath
  (each category keeps its own cloth colour), matching the look Tracker's volume contents already
  use. Clicking any row still jumps into the Tracker exactly as before.
- **A first-run state**: an account with nothing logged yet sees an invitation ("Nothing logged
  yet — open the Tracker to begin your first volume.") in place of the chapter/book tally: every
  other section already degrades gracefully to zero.
- **Reading Rhythm stays on Dashboard**, restyled to the same paper materials as everything else
  around it — see deviations below for why this wasn't moved to Profile as the PRD originally
  scoped.

## What was built

- **`frontend/src/Dashboard.tsx`** — full rewrite. One `<section>` styled like `ContentsLeaf`'s
  paper (laid-paper gradient, red rule, `boxShadow`, gilt `borderTop` in place of a volume's
  cloth colour, since Dashboard doesn't belong to one). Inside: head (date, greeting, red rule,
  progress-or-first-run line) → marginalia row (streak / today / weekly goal, goal editable in
  place) → `LeafDivider` → Reading Activity (`ActivityHeatmap`) → Continue Reading → Testament
  Progress → Category Progress → Reading Rhythm, each separated by a `LeafDivider`. The whole
  page sits on a flat `var(--color-shelf)` ground behind the leaf — the same dark family as
  Tracker's wood, but without Tracker's grain texture, so the two pages read as related but not
  identical (see decisions below). Data flow (`useBooksQuery`, `useDashboardQuery`,
  `useUpdateWeeklyGoal`, `calculateOverallProgress`, `calculateProgress`, `CATEGORY_ORDER`) is
  unchanged — this was a visual/layout rewrite only.
- **`frontend/src/components/DashboardEntryRow.tsx`** (new) — the shared ruled-entry row for
  Continue Reading, Testament Progress and Category Progress: label, optional leading icon, a
  leader-dot line (the same `radial-gradient` trick `ContentsLeaf` uses), a trailing figure, and
  a progress rule tinted by `ruleColor`. All three sections render one of these per row instead
  of three separate layouts.
- **`frontend/src/components/ActivityHeatmap.tsx`** — visual rework only. Replaced the five-step
  coloured-square legend with a pricked-dot treatment: `dotVisual()` maps a day's chapter count to
  either an unfilled ring (nothing logged) or a filled gilt dot whose opacity and size both grow
  with intensity, drawn by a small `Dot` component. `GILT` is now imported from
  `volumesTokens.ts` instead of being a re-typed hex literal. The `weeks`/`monthLabels`
  computation, the touch-tap portal tooltip, and the pointer `title` attribute are untouched —
  only cell/legend markup and colour changed. The tooltip's popup chrome now uses
  `var(--color-leaf)` / `var(--color-leaf-rule)` instead of a plain white box.
- **`frontend/src/components/ReadingRhythm.tsx`** — retokenized in place: dropped its own
  `rounded-2xl` white-card wrapper (it's now a subsection of Dashboard's leaf, not a floating
  card), swapped its section heading to the `vol-num` caption style every other Dashboard section
  uses, and retoned the window-toggle pill and the part-of-day bar colour off raw celestial-era
  rgba literals onto the leaf palette (`rgba(35,31,26,0.06)` pill background, gilt-derived part
  bar). No logic changes.
- **Deleted**: `frontend/src/components/BookCard.tsx`, `CircularProgress.tsx`, `ArcProgress.tsx`,
  and `frontend/src/lib/categoryColors.ts`. `BookCard` was Dashboard's only remaining consumer
  (Tracker replaced its use in milestone 2); once Continue Reading moved to `DashboardEntryRow`,
  nothing referenced `BookCard`, which was the only consumer of `ArcProgress` and of
  `categoryColors.getCategoryPalette`. `CircularProgress` was only the hero ring, also removed.
  `calculateProgress` (`trackerLogic.ts`) was kept — it's reused by Continue Reading's rows.

## Decisions made during implementation

All confirmed with the user before/during building:

- **The animated circular-progress hero is gone**, replaced by plain typographic figures ("799 of
  1,189 chapters · 23 of 66 books complete"), matching the PRD's "small closed set" wording.
- **Continue Reading / Testament / Category all use the new `DashboardEntryRow`** ruled-entry
  style instead of restyled `BookCard`s, retiring `BookCard` and the old `categoryColors` palette
  from Dashboard in favour of `CLOTH`.
- **Testament rows don't have a natural cloth colour** (OT/NT aren't one of the nine categories),
  so they use two of the leaf's other standing accents instead: `var(--color-leaf-red)` for Old
  Testament, `GILT` for New Testament.
- **Dashboard's page ground is a flat `var(--color-shelf)`**, not Tracker's textured wood-grain
  (`repeating-linear-gradient` + vertical gradient). Both are dark and from the same family, but
  Dashboard deliberately doesn't borrow Tracker's specific texture, on top of not showing the
  volume shelf itself — reinforcing the PRD's "never reads as the same page as Tracker" goal.
- **Skeleton loading placeholders needed no changes.** `Skeleton.tsx`'s existing muted-ink pulse
  (`rgba(35,31,26,0.07)`) already reads correctly against the leaf's cream paper — once the
  surrounding cards became leaf material, the same component was already "of the leaf" without
  a variant.

## Deviations from the PRD

- **Reading Rhythm stays on Dashboard, retokenized to leaf materials, instead of being removed
  as the PRD's milestone-3 scope specifies** ("Not in this milestone... Reading rhythm charts —
  those belong to Profile"). Confirmed with the user: removing it now would leave it unreachable
  in the UI until milestone 4 ships Profile, which the user preferred to avoid. **Milestone 4's
  agent needs to decide** whether to move `ReadingRhythm` out of Dashboard into Profile (and
  delete it here) or leave both — the PRD's intent is that Profile is its one home, not that both
  pages show it indefinitely.

## Anything the next milestone will need to know

- **`ReadingRhythm` is still imported and rendered by `Dashboard.tsx`** (see deviation above) —
  Profile's milestone 4 build should either move it there and remove Dashboard's copy, or make a
  deliberate call to leave both and note why.
- **`DashboardEntryRow.tsx` is Dashboard-only for now.** If Profile's cycle-history or achievement
  lists want the same leader-dot ruled-row treatment, it's a natural candidate to reuse or
  generalise further rather than rebuilding the pattern a third time.
- **`categoryColors.ts`, `BookCard.tsx`, `ArcProgress.tsx`, and `CircularProgress.tsx` are gone.**
  Nothing in the app uses the old celestial-era category-glow palette or arc-ring components any
  more; `CLOTH` (`volumesTokens.ts`) is now the only category-colour system in the codebase.
- **The `run-bible-books-tracker` skill's Playwright mock data still uses a stale category
  taxonomy** for a few categories (per milestone 2's log). This wasn't touched here either — it's
  the skill's fixture, not app code — but screenshots taken through the skill will still show
  Church History / Paul's Epistles / General Epistles as empty (0/0) volumes since the mock never
  assigns books to them.
- **Dashboard's leaf background recipe (`LEAF_STYLE` in `Dashboard.tsx`) duplicates
  `ContentsLeaf.tsx`'s paper gradient/shadow inline**, same as Tracker's `SHELF_BACKGROUND`
  duplicated its own wood-grain recipe in milestone 2. Now three places reference this specific
  laid-paper texture (Tracker's `ContentsLeaf`, and Dashboard) if Profile's milestone 4 wants the
  same paper surface for its bookplate, that's the point to extract it into a shared constant.
