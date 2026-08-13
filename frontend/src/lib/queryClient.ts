import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { DehydrateOptions } from '@tanstack/react-query'
import { UnauthorizedError } from './api'

const DAY_MS = 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Always revalidate on mount, focus and reconnect. The persister below is what
      // makes this cheap: cached data stays on screen while the refetch runs, so the
      // user never waits and never reads a silently old number. This matches the data
      // layer this replaced, which refetched unconditionally on every mount; its per-key
      // TTLs governed what was *displayed*, which is now the persister's job.
      staleTime: 0,
      // Must be >= the persister's maxAge. Left unset it defaults to 5 minutes, which
      // would garbage-collect the restored cache out from under the restore.
      gcTime: DAY_MS,
      // These two are the whole of the app's background-refresh behaviour — they
      // replace the hand-rolled 'online' and 'visibilitychange' listeners that used to
      // live in SyncContext and refresh only the views that happened to subscribe.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // fetchJson never retried, so TanStack's default of 3 attempts with
      // backoff would visibly delay error states. One retry covers a transient blip; a
      // 401 is never worth retrying (see UnauthorizedError).
      retry: (failureCount, error) => !(error instanceof UnauthorizedError) && failureCount < 1,
    },
    mutations: {
      retry: 0,
      // This app owns its own offline durability: a failed write is persisted to the
      // IndexedDB queue in offlineQueue.ts and replayed on reconnect, so it survives the
      // tab being closed. TanStack's default networkMode ('online') pauses a mutation
      // started while offline and never calls its mutationFn at all — which silently
      // bypasses that queue and leaves the write in memory only, where closing the tab
      // loses it. 'always' runs the mutationFn regardless, letting the queue do its job.
      networkMode: 'always',
    },
  },
})

export const persister = createSyncStoragePersister({
  // Undefined outside a browser — the unit tests import this module transitively and run
  // in node, where the persister degrades to a no-op rather than throwing at import time.
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'bible-tracker-query-cache',
})

/** How old a persisted cache may be before it is discarded rather than restored. */
export const PERSIST_MAX_AGE = DAY_MS

/**
 * Bump this whenever a cached payload's shape changes. A returning user's browser holds
 * a cache written by the previous deploy; without a buster the new code hydrates the old
 * shape and renders it.
 */
export const PERSIST_BUSTER = 'v1'

/**
 * Only successful queries are dehydrated (TanStack's default). Mutations are explicitly
 * excluded: offlineQueue.ts is the one durable owner of a pending write, and a second
 * copy in the persisted mutation cache would replay the same write twice on reconnect.
 */
export const dehydrateOptions: DehydrateOptions = {
  shouldDehydrateMutation: () => false,
}

/**
 * Wipe both halves of the cache. Called on logout so the next account to sign in on this
 * browser can't be shown the previous one's books, stats or name while its own load.
 */
export function clearPersistedCache(): void {
  queryClient.clear()
  void persister.removeClient()
}
