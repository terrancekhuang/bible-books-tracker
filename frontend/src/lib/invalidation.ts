import { queryKeys } from './queryKeys'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Which queries each kind of write makes stale, in one place.
 *
 * Callers name a domain operation rather than listing keys, so the three call sites
 * (Tracker's writes, cycle creation, and the offline queue's flush) cannot drift apart
 * — the class of bug this redesign exists to eliminate. Same convention as the
 * invalidate* functions in cache.ts, but over the query cache instead of localStorage.
 */

/**
 * Submit / undo / reset. Books aren't listed because those writes patch the book into
 * the cache directly from the server's response — only the derived views need refetching.
 *
 * Deliberately not awaited. Tracker awaits `submit`, and blocking that on a refetch
 * would stall the Tracker UI for no benefit; with neither page mounted this only marks
 * the queries stale and resolves immediately anyway.
 *
 * This still runs when the page that fired it has already unmounted, which is exactly
 * the navigate-away-before-the-write-lands case: callbacks on the options object handed
 * to `useMutation` fire regardless of the component's lifecycle, unlike callbacks passed
 * to `mutate()`.
 */
export function invalidateProgressWrite(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.statsAll() })
}

/**
 * Starting a new cycle. Every book's progress resets, so unlike a progress write this
 * has no server response to patch in — the grid has to be refetched wholesale.
 *
 * Awaited by the caller, which navigates to Tracker immediately afterwards: the grid's
 * first paint must be the new empty cycle, never the finished one. `refetchType: 'all'`
 * is what makes awaiting meaningful — the default refetches only *active* queries, and
 * nothing observes `books` from the Profile page, so a default invalidation would
 * resolve without fetching anything and Tracker would paint the old cycle first.
 */
export async function invalidateCycleCreated(queryClient: QueryClient): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: queryKeys.cycles() })
  invalidateProgressWrite(queryClient)
  await queryClient.invalidateQueries({ queryKey: queryKeys.books(), refetchType: 'all' })
}

/**
 * The offline queue drained. Only progress writes are ever queued, but they replayed
 * without going through the mutation's cache patch, so `books` is stale here too, as
 * are the per-cycle aggregates Profile shows. Matches the key set the pre-migration
 * flush cleared via invalidateCycle().
 */
export function invalidateQueueFlushed(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.books() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.cycles() })
  invalidateProgressWrite(queryClient)
}
