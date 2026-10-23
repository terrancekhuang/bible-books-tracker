import { describe, it, expect } from 'vitest'
import { calendarCells, formatChapters, groupByMonth, parseLocalDate, shiftMonth } from '../historyLogic'

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

describe('shiftMonth', () => {
  it('crosses year boundaries both ways', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-10', -2)).toBe('2026-08')
  })
})

describe('calendarCells', () => {
  it('pads to Monday and marks read days', () => {
    const cells = calendarCells('2026-10', new Map([['2026-10-15', 5]]))
    expect(cells.slice(0, 3)).toEqual([null, null, null]) // Oct 1 2026 is a Thursday
    expect(cells.length).toBe(3 + 31)
    expect(cells[3 + 14]).toEqual({ date: '2026-10-15', day: 15, chapters: 5 })
    expect(cells[3]?.chapters).toBeUndefined()
  })

  it('knows month lengths, leap Februaries included', () => {
    expect(calendarCells('2028-02', new Map()).filter(Boolean).length).toBe(29)
    expect(calendarCells('2027-02', new Map()).filter(Boolean).length).toBe(28)
    expect(calendarCells('2026-06', new Map())[0]).toEqual({ date: '2026-06-01', day: 1, chapters: undefined }) // a Monday
  })
})
