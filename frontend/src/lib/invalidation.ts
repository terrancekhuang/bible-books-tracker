import { queryKeys } from './queryKeys'
import { booksQueryOptions } from './queries'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Which queries each kind of write makes stale, in one place.
 *
 * Callers name a domain operation rather than listing keys, so the three call sites
 * (Tracker's writes, cycle creation, and the offline queue's flush) cannot drift apart
 * — the class of bug this redesign exists to eliminate.
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
  // Reading Rhythm counts the same timestamps a write just added. Navigating to Profile
  // would refetch it regardless (staleTime is 0), so what this actually buys is the
  // already-mounted case: a queue flush on reconnect refreshes the section in place
  // instead of leaving pre-write numbers on screen until the next navigation.
  void queryClient.invalidateQueries({ queryKey: queryKeys.rhythmAll() })
}

/**
 * Starting a new cycle. Every book's progress resets, so unlike a progress write this
 * has no server response to patch in — the grid has to be refetched wholesale.
 *
 * Awaited by the caller, which navigates to Tracker immediately afterwards: the grid's
 * first paint must be the new empty cycle, never the finished one.
 *
 * `fetchQuery`, not `invalidateQueries` — even with `refetchType: 'all'`. A books query
 * restored from the persister holds data but no `queryFn`: query options are bound when
 * a component mounts `useQuery`, and nothing observes books from Profile. Invalidating
 * such a query therefore resolves without fetching, and Tracker paints the cycle the
 * user just finished. Handing the options in is what guarantees a real request.
 *
 * If that request fails, the stale grid is dropped rather than kept: an empty grid for
 * one frame is recoverable, a wrong one is not.
 */
export async function invalidateCycleCreated(
  queryClient: QueryClient,
  logout: () => void,
): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: queryKeys.cycles() })
  invalidateProgressWrite(queryClient)
  await queryClient
    .fetchQuery(booksQueryOptions({ logout }))
    .catch(() => queryClient.removeQueries({ queryKey: queryKeys.books() }))
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
