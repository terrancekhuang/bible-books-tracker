import { describe, it, expect } from 'vitest'
import { formatChapters, groupByMonth, parseLocalDate } from '../historyLogic'

describe('formatChapters', () => {
  it('collapses runs and lists the rest', () => {
    expect(formatChapters([4, 5])).toBe('4–5')
    expect(formatChapters([1, 23])).toBe('1, 23')
    expect(formatChapters([1, 2, 3, 7, 9, 10])).toBe('1–3, 7, 9–10')
    expect(formatChapters([3])).toBe('3')
  })
})

describe('parseLocalDate', () => {
  it('lands on the named day whatever the timezone', () => {
    const d = parseLocalDate('2026-10-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1])
  })
})

describe('groupByMonth', () => {
  it('puts each day under its month with that month’s totals', () => {
    const day = (date: string, chapters: number) => ({ date, chapters, books: [] })
    const months = groupByMonth([day('2026-10-22', 3), day('2026-10-01', 1), day('2026-09-30', 2)])

    expect(months.map(m => [m.label, m.chapters, m.days.length])).toEqual([
      ['October 2026', 4, 2],
      ['September 2026', 2, 1],
    ])
  })
})
