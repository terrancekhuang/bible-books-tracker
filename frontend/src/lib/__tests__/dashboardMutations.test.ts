import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createUpdateWeeklyGoalMutationOptions, type DashboardMutationDeps } from '../dashboardMutations'
import { queryKeys } from '../queryKeys'
import type { DashboardData } from '../queries'

// queries.ts pulls in React context; only its DashboardData type is needed here, and
// types are erased at runtime, so nothing needs mocking for it.

const TZ_OFFSET = -300

const DASHBOARD: DashboardData = {
  stats: {
    chapters_today: 3,
    chapters_this_week: 12,
    chapters_last_7_days: 15,
    current_streak: 4,
    best_streak: 9,
    total_chapters: 120,
    total_days: 30,
  },
  activity: [{ logged_at: '2026-01-01', chapters: 3 }],
  weekly_goal: 7,
  user: { name: 'Reader', picture_url: null },
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

let queryClient: QueryClient
let deps: DashboardMutationDeps

/** The weekly goal as the cache currently holds it. */
function cachedGoal(): number | undefined {
  return queryClient.getQueryData<DashboardData>(queryKeys.dashboard(TZ_OFFSET))?.weekly_goal
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData<DashboardData>(queryKeys.dashboard(TZ_OFFSET), DASHBOARD)
  deps = { queryClient, tzOffset: TZ_OFFSET }

  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('updateWeeklyGoal', () => {
  it('writes the new goal into the cache before the request resolves', async () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)

    const context = await options.onMutate({ weeklyGoal: 21 })

    expect(cachedGoal()).toBe(21)
    expect(context.previous?.weekly_goal).toBe(7)
  })

  it('leaves the rest of the dashboard payload untouched', async () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    await options.onMutate({ weeklyGoal: 21 })

    const cached = queryClient.getQueryData<DashboardData>(queryKeys.dashboard(TZ_OFFSET))
    expect(cached?.stats).toEqual(DASHBOARD.stats)
    expect(cached?.activity).toEqual(DASHBOARD.activity)
    expect(cached?.user).toEqual(DASHBOARD.user)
  })

  it('returns the server-confirmed goal', async () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ weekly_goal: 21 })))

    expect(await options.mutationFn({ weeklyGoal: 21 })).toBe(21)
  })

  it('rolls back to the previous goal when the request fails', async () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    const context = await options.onMutate({ weeklyGoal: 21 })
    expect(cachedGoal()).toBe(21)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 500)))
    await expect(options.mutationFn({ weeklyGoal: 21 })).rejects.toThrow('Failed to save weekly goal')

    options.onError(new Error('Failed to save weekly goal'), { weeklyGoal: 21 }, context)
    expect(cachedGoal()).toBe(7)
  })

  it('rolls back on a network error too', async () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    const context = await options.onMutate({ weeklyGoal: 21 })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(options.mutationFn({ weeklyGoal: 21 })).rejects.toThrow()

    options.onError(new TypeError('Failed to fetch'), { weeklyGoal: 21 }, context)
    expect(cachedGoal()).toBe(7)
  })

  // A 401 is a plain failure here, not a logout — matching the pre-migration behaviour,
  // where the session ends on the next query fetch rather than on this write.
  it('rolls back on 401 without logging out', async () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    const context = await options.onMutate({ weeklyGoal: 21 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)))
    await expect(options.mutationFn({ weeklyGoal: 21 })).rejects.toThrow()

    options.onError(new Error('Failed to save weekly goal'), { weeklyGoal: 21 }, context)
    expect(cachedGoal()).toBe(7)
  })

  it('invalidates the dashboard once the write settles', () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()

    options.onSettled()

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboardAll() })
  })

  // The key carries the timezone offset, so a prefix match is what reaches whichever
  // offset variant the mounted Dashboard is actually using.
  it('invalidates by prefix, matching every timezone variant', () => {
    const options = createUpdateWeeklyGoalMutationOptions(deps)
    queryClient.setQueryData<DashboardData>(queryKeys.dashboard(60), { ...DASHBOARD, weekly_goal: 5 })

    options.onSettled()

    for (const offset of [TZ_OFFSET, 60]) {
      const state = queryClient.getQueryState(queryKeys.dashboard(offset))
      expect(state?.isInvalidated).toBe(true)
    }
  })
})
