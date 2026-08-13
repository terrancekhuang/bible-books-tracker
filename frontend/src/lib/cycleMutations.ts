import { api } from './api'
import { invalidateCycle } from './cache'
import { invalidateCycleCreated } from './invalidation'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Starting a new reading cycle, as a plain dependency-injected mutation-options factory.
 *
 * Same shape as trackerMutations.ts and dashboardMutations.ts: nothing here imports
 * React, so every branch is testable by calling the callbacks directly.
 */
export interface CycleMutationDeps {
  queryClient: QueryClient
  logout: () => void
}

export interface CreatedCycle {
  cycle_id: number
  cycle_number: number
}

export function createCreateCycleMutationOptions(deps: CycleMutationDeps) {
  return {
    // Not optimistic — the server assigns the cycle number, and there's nothing
    // meaningful to show until it has. Same asymmetry as undo/reset.
    mutationFn: async (): Promise<CreatedCycle | null> => {
      const response = await api.cycles.create()
      if (response.status === 401) {
        deps.logout()
        return null
      }
      if (!response.ok) throw new Error('Failed to create cycle')
      return await response.json() as CreatedCycle
    },

    // Awaited, unlike every other invalidation in the app: the caller navigates to
    // Tracker the moment this resolves, and awaiting here is what keeps the button in
    // its "Creating…" state until the grid can paint the new cycle rather than the
    // finished one. See invalidateCycleCreated.
    onSuccess: async (data: CreatedCycle | null) => {
      if (!data) return
      // LEGACY BRIDGE, and load-bearing: cache:books still seeds the grid's first paint.
      // Refetching the query can't help when the user loaded /profile directly, because
      // then no books query exists for the invalidation to reach — Tracker would mount
      // and paint the seed, i.e. the cycle just finished. Clearing it first means the
      // worst case is an empty grid for one frame rather than a wrong one. The event
      // makes BooksProvider rewrite the seed with the new cycle. Goes with cache.ts in
      // milestone 4, once the persister owns first paint.
      invalidateCycle()
      window.dispatchEvent(new CustomEvent('books-invalidated'))
      await invalidateCycleCreated(deps.queryClient)
    },

    onError: (error: unknown) => {
      console.error('Error creating cycle:', error)
    },
  }
}
