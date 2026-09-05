import { describe, it, expect } from 'vitest'
import { getAchievements } from '../achievements'
import type { Stats } from '../trackerLogic'
import type { Cycle } from '../queries'

function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    chapters_today: 0,
    chapters_this_week: 0,
    chapters_last_7_days: 0,
    current_streak: 0,
    best_streak: 0,
    total_chapters: 0,
    total_days: 0,
    ...overrides,
  }
}

function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    cycle_id: 1,
    cycle_number: 1,
    chapters_read: 0,
    total_chapters: 1189,
    books_complete: 0,
    ...overrides,
  }
}

describe('getAchievements', () => {
  it('returns all thirteen achievements, none earned, for a fresh account', () => {
    const result = getAchievements(null, [])
    expect(result).toHaveLength(13)
    expect(result.every(a => !a.earned)).toBe(true)
    // Every achievement always carries readable criteria, earned or not.
    expect(result.every(a => a.criteria.length > 0)).toBe(true)
  })

  it('earns streak achievements at their exact thresholds', () => {
    expect(getAchievements(makeStats({ best_streak: 6 }), []).find(a => a.id === 'streak-7')?.earned).toBe(false)
    expect(getAchievements(makeStats({ best_streak: 7 }), []).find(a => a.id === 'streak-7')?.earned).toBe(true)
    expect(getAchievements(makeStats({ best_streak: 364 }), []).find(a => a.id === 'streak-365')?.earned).toBe(false)
    expect(getAchievements(makeStats({ best_streak: 365 }), []).find(a => a.id === 'streak-365')?.earned).toBe(true)
  })

  it('earns chapter-count achievements at their exact thresholds', () => {
    const stats = makeStats({ total_chapters: 1000 })
    const result = getAchievements(stats, [])
    expect(result.find(a => a.id === 'chapters-100')?.earned).toBe(true)
    expect(result.find(a => a.id === 'chapters-500')?.earned).toBe(true)
    expect(result.find(a => a.id === 'chapters-1000')?.earned).toBe(true)
  })

  it('earns reading-day achievements at their exact thresholds', () => {
    const result = getAchievements(makeStats({ total_days: 100 }), [])
    expect(result.find(a => a.id === 'days-30')?.earned).toBe(true)
    expect(result.find(a => a.id === 'days-100')?.earned).toBe(true)
    expect(result.find(a => a.id === 'days-365')?.earned).toBe(false)
  })

  it('earns Second Journey once a second cycle exists, regardless of completion', () => {
    const oneCycle = getAchievements(null, [makeCycle()])
    const twoCycles = getAchievements(null, [makeCycle(), makeCycle({ cycle_id: 2, cycle_number: 2 })])
    expect(oneCycle.find(a => a.id === 'second-journey')?.earned).toBe(false)
    expect(twoCycles.find(a => a.id === 'second-journey')?.earned).toBe(true)
  })

  it('counts completed cycles as ones whose books_complete equals the full 66', () => {
    const cycles = [
      makeCycle({ cycle_id: 1, cycle_number: 1, books_complete: 66 }),
      makeCycle({ cycle_id: 2, cycle_number: 2, books_complete: 40 }),
    ]
    const result = getAchievements(null, cycles)
    expect(result.find(a => a.id === 'bible-complete')?.earned).toBe(true)
    expect(result.find(a => a.id === 'twice-blessed')?.earned).toBe(false)
  })

  it('earns Twice Blessed only with two fully-complete cycles', () => {
    const cycles = [
      makeCycle({ cycle_id: 1, cycle_number: 1, books_complete: 66 }),
      makeCycle({ cycle_id: 2, cycle_number: 2, books_complete: 66 }),
    ]
    expect(getAchievements(null, cycles).find(a => a.id === 'twice-blessed')?.earned).toBe(true)
  })

  it('returns the roster in the same fixed order regardless of what is earned', () => {
    const ids = getAchievements(makeStats({ best_streak: 500, total_chapters: 2000, total_days: 400 }), []).map(a => a.id)
    expect(ids).toEqual([
      'streak-7', 'streak-30', 'streak-100', 'streak-365',
      'chapters-100', 'chapters-500', 'chapters-1000',
      'days-30', 'days-100', 'days-365',
      'second-journey', 'bible-complete', 'twice-blessed',
    ])
  })
})
