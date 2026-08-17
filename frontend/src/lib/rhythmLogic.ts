/**
 * The `/api/rhythm` payload and every decision the Reading Rhythm section makes about it.
 *
 * The section shows *when* a reader reads. `logged_at` records when a chapter was logged
 * rather than when it was read, so the day-of-week signal leads and the part-of-day signal
 * only gets named in words when it leads clearly — see PART_MIN_SHARE / PART_MIN_RATIO.
 */

export type RhythmWindowKey = 'all_time' | 'last_90_days'
export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

/** One window of the rhythm. `by_weekday` is Monday-first — the backend groups by ISODOW. */
export interface RhythmWindow {
  by_weekday: number[]
  by_part_of_day: Record<PartOfDay, number>
  total_chapters: number
  distinct_days: number
}

/** Both windows arrive together, so the toggle switches without refetching. */
export type RhythmData = Record<RhythmWindowKey, RhythmWindow>

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Chronological, not by size, so the strip doesn't reshuffle when the window changes. */
export const PART_ORDER: PartOfDay[] = ['morning', 'afternoon', 'evening', 'night']

export const PART_LABELS: Record<PartOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
}

/** Below this much logged, the bars still show but the app names no pattern at all. */
export const MIN_CHAPTERS = 20
export const MIN_DAYS = 7

// A part of day is only named when it both holds a real share of the window and beats the
// runner-up. Share alone would speak on a 45/44 near-tie; ratio alone would speak on a 34%
// plurality against three fragmented rivals. Neither is a lead worth claiming.
export const PART_MIN_SHARE = 0.4
export const PART_MIN_RATIO = 1.5

// Both measured against the even baseline of total/7, so they scale with how much is logged.
// A reader whose busiest day is barely above average has no favorite day; one whose busiest
// day carries double the average does. Between the two, nothing about the week is claimed.
export const WEEK_EVEN_MAX_RATIO = 1.5
export const WEEK_PEAK_MIN_RATIO = 2.0

// A favorite day must also stand apart from the *next* busiest, not just from the average.
// Without this, Sat 30 / Sun 29 is called a Saturday habit — Saturday clears 2x the average,
// yet plainly does not lead. This subsumes an exact-tie check, which scores 1.0 here.
export const WEEK_PEAK_MIN_LEAD = 1.5

/** Monday-first, so Saturday and Sunday are the last two slots. */
export const WEEKDAY_INDICES = [0, 1, 2, 3, 4]
export const WEEKEND_INDICES = [5, 6]

// Compared per day, never by total: there are five weekdays to two weekend days, so an
// evenly-spread reader has 71% of their chapters on weekdays and a share test would call
// every reader a weekday reader. Per-day averages put the two on equal footing.
export const WEEK_LEAN_MIN_RATIO = 1.5

/** Index into a Monday-first week, or null when nothing is logged. Earliest day wins a tie. */
export function strongestWeekday(window: RhythmWindow): number | null {
  if (window.total_chapters === 0) return null
  let best = 0
  for (let i = 1; i < window.by_weekday.length; i++) {
    if (window.by_weekday[i] > window.by_weekday[best]) best = i
  }
  return window.by_weekday[best] > 0 ? best : null
}

export type WeekPattern = 'peaked' | 'weekdays' | 'weekends' | 'even' | 'mixed'

/** Average chapters per day across a set of weekday slots. */
function perDay(window: RhythmWindow, indices: number[]): number {
  return indices.reduce((sum, i) => sum + window.by_weekday[i], 0) / indices.length
}

/**
 * How the week is shaped, which decides what — if anything — is worth saying about it.
 *
 * - `peaked`   one day is both well above the average and well clear of the next busiest, so
 *              it is a real favorite rather than whichever day edged ahead.
 * - `weekdays` / `weekends` — no single day stands out, but one half of the week is
 *              consistently busier per day than the other.
 * - `even`     every weekday has reading on it and the busiest is close to the average. For a
 *              daily reading habit this is the good outcome, not the absence of a finding.
 * - `mixed`    none of the above. Some variation, but nothing that would survive being named.
 *
 * Checked in that order: most specific claim first. A single named day beats a half-week lean,
 * and a lean beats "even" — a reader at 12/12/12/12/12/20/20 is broadly flat but really does
 * lean to the weekend, and saying so is more use than calling it even.
 *
 * Two adjacent busy days therefore fall through to the lean rather than being reported as one
 * favorite day, which is what a Saturday-and-Sunday reader actually means.
 */
export function weekdayPattern(window: RhythmWindow): WeekPattern {
  if (window.total_chapters === 0) return 'mixed'

  const mean = window.total_chapters / 7
  const [busiest, runnerUp] = [...window.by_weekday].sort((a, b) => b - a)

  // Both tests must pass: ahead of the average, and ahead of the next busiest day.
  if (busiest >= mean * WEEK_PEAK_MIN_RATIO && busiest >= runnerUp * WEEK_PEAK_MIN_LEAD) return 'peaked'

  // A zero on either side gives Infinity here, which is the right answer: never reading at
  // weekends is the strongest weekday lean there is.
  const weekdays = perDay(window, WEEKDAY_INDICES)
  const weekends = perDay(window, WEEKEND_INDICES)
  if (weekdays / weekends >= WEEK_LEAN_MIN_RATIO) return 'weekdays'
  if (weekends / weekdays >= WEEK_LEAN_MIN_RATIO) return 'weekends'

  if (window.by_weekday.every(count => count > 0) && busiest <= mean * WEEK_EVEN_MAX_RATIO) return 'even'

  return 'mixed'
}

/**
 * Which bars to draw in the full accent. Dimming the rest is itself a claim, so this returns
 * exactly the days the sentence is willing to stand behind — every day when it names none.
 */
export function emphasizedWeekdays(window: RhythmWindow): Set<number> {
  switch (weekdayPattern(window)) {
    case 'peaked':   return new Set([strongestWeekday(window)!])
    case 'weekdays': return new Set(WEEKDAY_INDICES)
    case 'weekends': return new Set(WEEKEND_INDICES)
    default:         return new Set(window.by_weekday.map((_, i) => i))
  }
}

/** The part of day worth mentioning, or null when no single part clearly leads. */
export function leadingPartOfDay(window: RhythmWindow): PartOfDay | null {
  if (window.total_chapters === 0) return null

  const sorted = PART_ORDER
    .map(part => ({ part, count: window.by_part_of_day[part] }))
    .sort((a, b) => b.count - a.count)

  const [first, second] = sorted
  if (first.count === second.count) return null
  if (first.count / window.total_chapters < PART_MIN_SHARE) return null
  // second.count is below first.count and can be 0, in which case the lead is total.
  if (second.count > 0 && first.count / second.count < PART_MIN_RATIO) return null
  return first.part
}

export function hasEnoughData(window: RhythmWindow): boolean {
  return window.total_chapters >= MIN_CHAPTERS && window.distinct_days >= MIN_DAYS
}

/**
 * The one line of prose under the charts. Evaluated per window: switching to Last 90 days
 * can legitimately drop a reader below the threshold, which is correct, not a bug.
 *
 * Returns '' when there is nothing logged at all — the section renders its empty line there
 * instead, since a reader with no data needs an invitation rather than encouragement.
 *
 * The two clauses are independent. Earlier drafts always led with a favorite day, which
 * misreads the reader this feature should be kindest to: someone spread evenly across the
 * week has no favorite day, and naming one off the noise claims a habit they don't have. So
 * the week gets whichever of five readings it actually supports — see `weekdayPattern` — and
 * when it supports none the sentence is happy to carry the time of day alone.
 */
export function insightSentence(window: RhythmWindow): string {
  if (window.total_chapters === 0) return ''
  if (!hasEnoughData(window)) return "Keep logging — your rhythm will appear once there's more to go on."

  const part = leadingPartOfDay(window)
  // "in the morning" reads better than "in the night", which is the one bucket needing 'at'.
  const when = part === null ? '' : part === 'night' ? 'at night' : `in the ${part}`

  switch (weekdayPattern(window)) {
    case 'even':
      // "Consistent" rather than "spread evenly": this is the outcome the app is trying to
      // encourage, so the one branch that describes it should read as credit rather than as a
      // neutral observation. Still not "you read every day" — over a long history every weekday
      // is non-empty anyway, so that would overclaim a streak, and streaks have their own stat
      // card on Profile.
      return when
        ? `Your reading is consistent throughout the week, usually ${when}.`
        : 'Your reading is consistent throughout the week.'

    case 'peaked': {
      const day = WEEKDAY_FULL[strongestWeekday(window)!]
      return when
        ? `You read most on ${day}s, usually ${when}.`
        : `You read most on ${day}s.`
    }

    case 'weekdays':
      return when
        ? `You read mostly on weekdays, usually ${when}.`
        : 'You read mostly on weekdays.'

    case 'weekends':
      return when
        ? `You read mostly on weekends, usually ${when}.`
        : 'You read mostly on weekends.'

    default:
      return when
        ? `You usually read ${when}.`
        : "Your reading doesn't settle into a particular day or time."
  }
}
