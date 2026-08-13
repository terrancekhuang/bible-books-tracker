import { QueryClient } from '@tanstack/react-query'
import { UnauthorizedError } from './api'

// Freshness windows are provisional. The old cache.ts used per-key TTLs (5 min for
// stats/activity/dashboard, 24 h for books/user); matching today's feel exactly,
// across every page at once, is milestone 4's job — not something to tune per-page
// as each milestone migrates.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // The old fetchJson/useCachedFetch path never retried, so TanStack's default
      // of 3 attempts with backoff would visibly delay error states. One retry
      // covers a transient blip; a 401 is never worth retrying (see UnauthorizedError).
      retry: (failureCount, error) => !(error instanceof UnauthorizedError) && failureCount < 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
