import type { Cycle } from './queries'
import type { Stats } from './trackerLogic'
import { TOTAL_BOOKS } from './trackerLogic'

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'rainbow'
export type AchievementIcon = 'flame' | 'book' | 'calendar' | 'trophy'

export interface AchievementDef {
  id: string
  label: string
  /** Always shown, earned or not — an unearned medallion still tells you what to do. */
  criteria: string
  tier: BadgeTier
  icon: AchievementIcon
  earned: boolean
}

/**
 * The fixed roster of thirteen achievements, always returned in the same order regardless of
 * what's earned — Profile renders the whole roster every time, gilt where earned and
 * blind-stamped where not. Thresholds are unchanged from before this milestone; only the
 * `criteria` copy and the always-visible roster are new.
 */
export function getAchievements(stats: Stats | null, cycles: Cycle[]): AchievementDef[] {
  const bestStreak = stats?.best_streak ?? 0
  const totalChapters = stats?.total_chapters ?? 0
  const totalDays = stats?.total_days ?? 0
  const completedCycles = cycles.filter(c => c.books_complete === TOTAL_BOOKS).length

  return [
    { id: 'streak-7', label: '7-Day Streak', criteria: 'Read 7 days in a row', tier: 'bronze', icon: 'flame', earned: bestStreak >= 7 },
    { id: 'streak-30', label: '30-Day Streak', criteria: 'Read 30 days in a row', tier: 'silver', icon: 'flame', earned: bestStreak >= 30 },
    { id: 'streak-100', label: '100-Day Streak', criteria: 'Read 100 days in a row', tier: 'gold', icon: 'flame', earned: bestStreak >= 100 },
    { id: 'streak-365', label: 'Year-Long Streak', criteria: 'Read 365 days in a row', tier: 'rainbow', icon: 'flame', earned: bestStreak >= 365 },

    { id: 'chapters-100', label: '100 Chapters', criteria: 'Log 100 chapters', tier: 'bronze', icon: 'book', earned: totalChapters >= 100 },
    { id: 'chapters-500', label: '500 Chapters', criteria: 'Log 500 chapters', tier: 'silver', icon: 'book', earned: totalChapters >= 500 },
    { id: 'chapters-1000', label: '1,000 Chapters', criteria: 'Log 1,000 chapters', tier: 'gold', icon: 'book', earned: totalChapters >= 1000 },

    { id: 'days-30', label: '30 Reading Days', criteria: 'Read on 30 different days', tier: 'bronze', icon: 'calendar', earned: totalDays >= 30 },
    { id: 'days-100', label: '100 Reading Days', criteria: 'Read on 100 different days', tier: 'silver', icon: 'calendar', earned: totalDays >= 100 },
    { id: 'days-365', label: '365 Reading Days', criteria: 'Read on 365 different days', tier: 'gold', icon: 'calendar', earned: totalDays >= 365 },

    { id: 'second-journey', label: 'Second Journey', criteria: 'Start a second reading cycle', tier: 'silver', icon: 'trophy', earned: cycles.length >= 2 },
    { id: 'bible-complete', label: 'Bible Complete', criteria: 'Finish every book in one cycle', tier: 'rainbow', icon: 'trophy', earned: completedCycles >= 1 },
    { id: 'twice-blessed', label: 'Twice Blessed', criteria: 'Finish every book in two cycles', tier: 'rainbow', icon: 'trophy', earned: completedCycles >= 2 },
  ]
}
