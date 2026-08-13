import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createUpdateWeeklyGoalMutationOptions } from './dashboardMutations'
import { useTzOffset } from './queries'

/** Wires the weekly-goal factory in dashboardMutations.ts up to React context. */
export function useUpdateWeeklyGoal(): { save: (weeklyGoal: number) => Promise<boolean> } {
  const queryClient = useQueryClient()
  const tzOffset = useTzOffset()

  const { mutateAsync } = useMutation(
    createUpdateWeeklyGoalMutationOptions({ queryClient, tzOffset }),
  )

  // Resolves to whether the write stuck. onError has already rolled the cache back
  // by then; the caller only needs to know whether to show its inline error.
  const save = useCallback(async (weeklyGoal: number): Promise<boolean> => {
    try {
      await mutateAsync({ weeklyGoal })
      return true
    } catch {
      return false
    }
  }, [mutateAsync])

  return { save }
}
