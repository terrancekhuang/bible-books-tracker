import { api } from './api'
import { queryKeys } from './queryKeys'
import type { QueryClient } from '@tanstack/react-query'
import type { DashboardData, SettingsData } from './queries'

/**
 * Dashboard's only write, as a plain dependency-injected mutation-options factory.
 *
 * Same shape as trackerMutations.ts: nothing here imports React, so every branch
 * (optimistic update, rollback, invalidation) is testable by calling the callbacks
 * directly against a real QueryClient.
 */
export interface DashboardMutationDeps {
  queryClient: QueryClient
  tzOffset: number
}

interface GoalVars {
  weeklyGoal: number
}

interface GoalContext {
  previousDashboard: DashboardData | undefined
  previousSettings: SettingsData | undefined
}

export function createUpdateWeeklyGoalMutationOptions(deps: DashboardMutationDeps) {
  const dashboardKey = queryKeys.dashboard(deps.tzOffset)
  const settingsKey = queryKeys.settings()

  return {
    mutationFn: async ({ weeklyGoal }: GoalVars): Promise<number> => {
      // A 401 lands here as a plain failure rather than a logout. That matches the
      // behaviour before this migration: the goal rolls back and the inline error
      // shows, and the next query fetch is what actually ends the session.
      const response = await api.settings.update(weeklyGoal)
      if (!response.ok) throw new Error('Failed to save weekly goal')
      const data = await response.json() as { weekly_goal: number }
      return data.weekly_goal
    },

    // Writing straight into both caches is what preserves the instant-save feel a local
    // useState gave us before — Dashboard and Profile each edit the same goal, so both need
    // the optimistic write regardless of which page made it.
    onMutate: async ({ weeklyGoal }: GoalVars): Promise<GoalContext> => {
      await deps.queryClient.cancelQueries({ queryKey: dashboardKey })
      await deps.queryClient.cancelQueries({ queryKey: settingsKey })
      const previousDashboard = deps.queryClient.getQueryData<DashboardData>(dashboardKey)
      const previousSettings = deps.queryClient.getQueryData<SettingsData>(settingsKey)
      deps.queryClient.setQueryData<DashboardData>(dashboardKey, (old) =>
        old && { ...old, weekly_goal: weeklyGoal }
      )
      deps.queryClient.setQueryData<SettingsData>(settingsKey, (old) =>
        ({ ...old, weekly_goal: weeklyGoal })
      )
      return { previousDashboard, previousSettings }
    },

    onError: (error: unknown, _vars: GoalVars, context: GoalContext | undefined) => {
      if (context?.previousDashboard) deps.queryClient.setQueryData(dashboardKey, context.previousDashboard)
      if (context?.previousSettings) deps.queryClient.setQueryData(settingsKey, context.previousSettings)
      console.error('Error saving weekly goal:', error)
    },

    // The goal changes how far along the weekly progress bar reads, so refetch
    // rather than trusting the optimistic value indefinitely.
    onSettled: () => {
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll() })
      void deps.queryClient.invalidateQueries({ queryKey: settingsKey })
    },
  }
}
