import { describe, it, expect } from 'vitest'
import {
  emphasizedWeekdays,
  hasEnoughData,
  insightSentence,
  leadingPartOfDay,
  strongestWeekday,
  weekdayPattern,
  type PartOfDay,
  type RhythmWindow,
} from '../rhythmLogic'

/**
 * Builds a window from just the parts a test cares about. `by_weekday` is Monday-first and
 * `total_chapters` defaults to the sum of whichever breakdown was supplied, so a test states
 * a shape rather than keeping three numbers in sync by hand.
 */
function makeWindow(overrides: {
  by_weekday?: number[]
  by_part_of_day?: Partial<Record<PartOfDay, number>>
  total_chapters?: number
  distinct_days?: number
} = {}): RhythmWindow {
  const by_weekday = overrides.by_weekday ?? [0, 0, 0, 0, 0, 0, 0]
  const by_part_of_day = {
    morning: 0, afternoon: 0, evening: 0, night: 0,
    ...overrides.by_part_of_day,
  }
  const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
  const total = overrides.total_chapters
    ?? Math.max(sum(by_weekday), sum(Object.values(by_part_of_day)))
  return {
    by_weekday,
    by_part_of_day,
    total_chapters: total,
    // Enough by default, so threshold behaviour is only in play when a test asks for it.
    distinct_days: overrides.distinct_days ?? 30,
  }
}

describe('strongestWeekday', () => {
  it('returns the index of the busiest day', () => {
    expect(strongestWeekday(makeWindow({ by_weekday: [12, 4, 9, 3, 15, 22, 8] }))).toBe(5)
  })

  // The backend groups by ISODOW, so index 6 is Sunday, not Saturday. Getting this wrong
  // would silently name the day next to the real one.
  it('indexes Monday-first, so the last slot is Sunday', () => {
    expect(strongestWeekday(makeWindow({ by_weekday: [1, 1, 1, 1, 1, 1, 40] }))).toBe(6)
  })

  it('picks the earliest day when two tie', () => {
    expect(strongestWeekday(makeWindow({ by_weekday: [0, 20, 5, 0, 20, 0, 0] }))).toBe(1)
  })

  it('returns null when nothing is logged', () => {
    expect(strongestWeekday(makeWindow())).toBeNull()
  })
})

describe('weekdayPattern', () => {
  it('calls an even spread even', () => {
    // total 123, mean 17.6, busiest 20 = 1.14x
    expect(weekdayPattern(makeWindow({ by_weekday: [18, 16, 19, 17, 15, 20, 18] }))).toBe('even')
  })

  // The whole point of the change: a reader spread across the week has no favorite day, and
  // the old rule named one anyway off whichever day happened to be a little ahead.
  it('does not call a nearly-even week peaked', () => {
    expect(weekdayPattern(makeWindow({ by_weekday: [14, 15, 16, 14, 15, 17, 15] }))).not.toBe('peaked')
  })

  it('refuses even when a weekday is empty, however tight the rest', () => {
    // total 100, mean 14.3, busiest 20 = 1.4x — but nothing is ever logged on Monday.
    expect(weekdayPattern(makeWindow({ by_weekday: [0, 20, 20, 20, 20, 10, 10] }))).not.toBe('even')
  })

  it('calls a real favorite day peaked', () => {
    // total 96, mean 13.7. Sunday 45 is 3.3x the average and 4.1x the next busiest day.
    expect(weekdayPattern(makeWindow({ by_weekday: [10, 8, 9, 7, 11, 6, 45] }))).toBe('peaked')
  })

  // Regression: the peak test used to compare only against the average, so Saturday cleared
  // 2x with Sunday one chapter behind it and the app reported "You read most on Saturdays".
  it('needs the busiest day to lead the runner-up, not just the average', () => {
    // Saturday is 2.1x the daily average but only 1.03x Sunday — it leads nothing.
    expect(weekdayPattern(makeWindow({ by_weekday: [8, 9, 8, 7, 9, 30, 29] }))).not.toBe('peaked')
  })

  it('leaves the middle ground unclaimed', () => {
    // total 100, mean 14.3, busiest 25 = 1.75x — past even, short of a favorite.
    expect(weekdayPattern(makeWindow({ by_weekday: [10, 25, 12, 20, 8, 15, 10] }))).toBe('mixed')
  })

  // Naming one of two equal days hides the other, so neither gets named.
  it('will not pick a favorite out of a tie', () => {
    expect(weekdayPattern(makeWindow({ by_weekday: [8, 8, 8, 8, 8, 30, 30] }))).not.toBe('peaked')
  })

  it('is mixed when nothing is logged', () => {
    expect(weekdayPattern(makeWindow())).toBe('mixed')
  })

  describe('weekday / weekend lean', () => {
    it('catches a weekend reader', () => {
      // Per day: weekdays 8, weekends 30 — a 3.75x lean. Neither Saturday nor Sunday can be
      // `peaked` while the other is beside it, which is the shape this reading exists to rescue.
      expect(weekdayPattern(makeWindow({ by_weekday: [8, 8, 8, 8, 8, 30, 30] }))).toBe('weekends')
      expect(weekdayPattern(makeWindow({ by_weekday: [8, 9, 8, 7, 9, 30, 29] }))).toBe('weekends')
    })

    it('catches a reader who never reads at weekends', () => {
      // Per day: weekdays 20, weekends 0 — an infinite lean, and the right answer.
      expect(weekdayPattern(makeWindow({ by_weekday: [20, 20, 20, 20, 20, 0, 0] }))).toBe('weekdays')
    })

    // The trap this whole reading has to avoid: 5 days against 2 means an evenly-spread reader
    // logs 71% of their chapters on weekdays. Comparing totals would call everyone a weekday
    // reader; comparing per-day averages does not.
    it('does not mistake an even week for a weekday lean', () => {
      expect(weekdayPattern(makeWindow({ by_weekday: [10, 10, 10, 10, 10, 10, 10] }))).toBe('even')
    })

    it('needs a real gap, not any gap at all', () => {
      // Per day: weekdays 15, weekends 12.5 — only 1.2x, so nothing is claimed.
      expect(weekdayPattern(makeWindow({ by_weekday: [10, 25, 12, 20, 8, 15, 10] }))).toBe('mixed')
    })

    // A lean is a broader claim than a single day, so the more specific one wins.
    it('yields to a genuine single-day favorite', () => {
      // Weekends lead per day (40 vs 18.4), but Sunday alone is 2.2x the daily average.
      expect(weekdayPattern(makeWindow({ by_weekday: [31, 12, 22, 9, 18, 26, 54] }))).toBe('peaked')
    })

    // Broadly flat, but the weekend really is busier per day, and saying so beats "even".
    it('takes precedence over even when the week is flat but tilted', () => {
      expect(weekdayPattern(makeWindow({ by_weekday: [12, 12, 12, 12, 12, 20, 20] }))).toBe('weekends')
    })
  })
})

describe('emphasizedWeekdays', () => {
  it('accents the one named day when there is a favorite', () => {
    const w = makeWindow({ by_weekday: [10, 8, 9, 7, 11, 6, 45] })
    expect([...emphasizedWeekdays(w)]).toEqual([6])
  })

  it('accents Monday to Friday for a weekday reader', () => {
    const w = makeWindow({ by_weekday: [20, 20, 20, 20, 20, 0, 0] })
    expect([...emphasizedWeekdays(w)].sort()).toEqual([0, 1, 2, 3, 4])
  })

  it('accents Saturday and Sunday for a weekend reader', () => {
    const w = makeWindow({ by_weekday: [8, 8, 8, 8, 8, 30, 30] })
    expect([...emphasizedWeekdays(w)].sort()).toEqual([5, 6])
  })

  // Dimming any bar asserts a pattern; when the sentence names none, nothing may be dimmed.
  it('accents every day when no pattern is claimed', () => {
    for (const by_weekday of [[10, 10, 10, 10, 10, 10, 10], [10, 25, 12, 20, 8, 15, 10]]) {
      expect(emphasizedWeekdays(makeWindow({ by_weekday })).size).toBe(7)
    }
  })
})

describe('leadingPartOfDay', () => {
  it('names the part when it clears both the share and the ratio', () => {
    const w = makeWindow({ by_part_of_day: { morning: 12, afternoon: 8, evening: 60, night: 16 } })
    expect(leadingPartOfDay(w)).toBe('evening')
  })

  it('names it when every other part is empty', () => {
    expect(leadingPartOfDay(makeWindow({ by_part_of_day: { evening: 30 } }))).toBe('evening')
  })

  // 45% share, but only 1.02x the runner-up — a plurality, not a lead.
  it('stays quiet on a near-tie between two large parts', () => {
    const w = makeWindow({ by_part_of_day: { morning: 45, afternoon: 44, evening: 6, night: 5 } })
    expect(leadingPartOfDay(w)).toBeNull()
  })

  // 34% share against three even rivals clears 1.5x but is too thin a slice to claim.
  it('stays quiet when the ratio passes but the share does not', () => {
    const w = makeWindow({ by_part_of_day: { morning: 34, afternoon: 22, evening: 22, night: 22 } })
    expect(leadingPartOfDay(w)).toBeNull()
  })

  // 43% share, 41/29 = 1.41x — the PRD's own example payload, deliberately below the bar.
  it('stays quiet when the share passes but the ratio does not', () => {
    const w = makeWindow({ by_part_of_day: { morning: 29, afternoon: 13, evening: 41, night: 13 } })
    expect(leadingPartOfDay(w)).toBeNull()
  })

  it('stays quiet when two parts tie for first', () => {
    expect(leadingPartOfDay(makeWindow({ by_part_of_day: { morning: 50, night: 50 } }))).toBeNull()
  })

  it('returns null when nothing is logged', () => {
    expect(leadingPartOfDay(makeWindow())).toBeNull()
  })
})

describe('hasEnoughData', () => {
  it('needs 20 chapters', () => {
    expect(hasEnoughData(makeWindow({ total_chapters: 19, distinct_days: 10 }))).toBe(false)
    expect(hasEnoughData(makeWindow({ total_chapters: 20, distinct_days: 10 }))).toBe(true)
  })

  it('needs 7 distinct days', () => {
    expect(hasEnoughData(makeWindow({ total_chapters: 40, distinct_days: 6 }))).toBe(false)
    expect(hasEnoughData(makeWindow({ total_chapters: 40, distinct_days: 7 }))).toBe(true)
  })
})

describe('insightSentence', () => {
  it('says nothing at all when nothing is logged', () => {
    expect(insightSentence(makeWindow({ distinct_days: 0 }))).toBe('')
  })

  it('encourages rather than guessing below the threshold', () => {
    const w = makeWindow({ by_weekday: [0, 0, 0, 0, 0, 8, 0], distinct_days: 2 })
    expect(insightSentence(w)).toBe("Keep logging — your rhythm will appear once there's more to go on.")
  })

  it('states an even week as its own finding', () => {
    const w = makeWindow({
      by_weekday: [18, 16, 19, 17, 15, 20, 18],
      by_part_of_day: { morning: 40, afternoon: 30, evening: 30, night: 23 },
      total_chapters: 123,
      distinct_days: 40,
    })
    expect(insightSentence(w)).toBe('Your reading is consistent throughout the week.')
  })

  it('pairs an even week with the time of day when one leads', () => {
    const w = makeWindow({
      by_weekday: [18, 16, 19, 17, 15, 20, 18],
      by_part_of_day: { morning: 15, afternoon: 12, evening: 80, night: 16 },
      total_chapters: 123,
      distinct_days: 40,
    })
    expect(insightSentence(w)).toBe('Your reading is consistent throughout the week, usually in the evening.')
  })

  it('names a weekend habit', () => {
    const w = makeWindow({
      by_weekday: [8, 8, 8, 8, 8, 30, 30],
      by_part_of_day: { morning: 70, afternoon: 12, evening: 10, night: 8 },
      total_chapters: 100,
      distinct_days: 30,
    })
    expect(insightSentence(w)).toBe('You read mostly on weekends, usually in the morning.')
  })

  it('names a weekday habit without a time when none leads', () => {
    const w = makeWindow({
      by_weekday: [20, 20, 20, 20, 20, 0, 0],
      by_part_of_day: { morning: 30, afternoon: 25, evening: 25, night: 20 },
      total_chapters: 100,
      distinct_days: 30,
    })
    expect(insightSentence(w)).toBe('You read mostly on weekdays.')
  })

  // Previously this reader was told "You read most on Tuesdays" off a 1.75x wobble.
  it('carries the time of day alone when the week says nothing', () => {
    const w = makeWindow({
      by_weekday: [10, 25, 12, 20, 8, 15, 10],
      by_part_of_day: { morning: 60, afternoon: 20, evening: 12, night: 8 },
      total_chapters: 100,
      distinct_days: 30,
    })
    expect(insightSentence(w)).toBe('You usually read in the morning.')
  })

  it('says so plainly when neither the day nor the time settles', () => {
    const w = makeWindow({
      by_weekday: [10, 25, 12, 20, 8, 15, 10],
      by_part_of_day: { morning: 30, afternoon: 25, evening: 25, night: 20 },
      total_chapters: 100,
      distinct_days: 30,
    })
    expect(insightSentence(w)).toBe("Your reading doesn't settle into a particular day or time.")
  })

  // 'night' is the one bucket where "in the night" reads wrong.
  it('says "at night" rather than "in the night"', () => {
    const w = makeWindow({
      by_weekday: [10, 8, 9, 7, 11, 6, 45],
      by_part_of_day: { morning: 8, afternoon: 8, evening: 10, night: 70 },
      total_chapters: 96,
      distinct_days: 34,
    })
    expect(insightSentence(w)).toBe('You read most on Sundays, usually at night.')
  })

  it('names only the day when no part of day clearly leads', () => {
    const w = makeWindow({
      by_weekday: [10, 8, 9, 7, 11, 6, 45],
      by_part_of_day: { morning: 29, afternoon: 13, evening: 41, night: 13 },
      total_chapters: 96,
      distinct_days: 34,
    })
    expect(insightSentence(w)).toBe('You read most on Sundays.')
  })

  it('names the day and the part when one leads', () => {
    const w = makeWindow({
      by_weekday: [10, 8, 9, 7, 11, 6, 45],
      by_part_of_day: { morning: 8, afternoon: 8, evening: 70, night: 10 },
      total_chapters: 96,
      distinct_days: 34,
    })
    expect(insightSentence(w)).toBe('You read most on Sundays, usually in the evening.')
  })

  // The toggle re-evaluates per window, so a reader with years of history can drop below the
  // threshold on Last 90 days. That is correct behaviour, not a bug.
  it('is evaluated per window, so the same reader can speak all-time and stay quiet recently', () => {
    const allTime = makeWindow({
      by_weekday: [10, 8, 9, 7, 11, 6, 45],
      by_part_of_day: { morning: 8, afternoon: 8, evening: 70, night: 10 },
      total_chapters: 96,
      distinct_days: 34,
    })
    const recent = makeWindow({
      by_weekday: [0, 0, 4, 0, 0, 0, 3],
      by_part_of_day: { evening: 7 },
      total_chapters: 7,
      distinct_days: 2,
    })

    expect(insightSentence(allTime)).toBe('You read most on Sundays, usually in the evening.')
    expect(insightSentence(recent)).toBe("Keep logging — your rhythm will appear once there's more to go on.")
  })
})
