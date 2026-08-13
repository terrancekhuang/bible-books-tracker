// Central query-key factory — every cache key in the app is defined here, so
// mutations invalidate by calling a function rather than retyping a key array.
export const queryKeys = {
  books: () => ['books'] as const,
  currentUser: () => ['auth', 'me'] as const,
  cycles: () => ['cycles'] as const,
  favorites: () => ['favorites'] as const,
  // The dashboard is keyed by timezone offset, so writes invalidate by prefix to
  // catch every offset variant at once rather than guessing the active one.
  dashboardAll: () => ['dashboard'] as const,
  dashboard: (tzOffset: number) => ['dashboard', tzOffset] as const,
  // Same prefix arrangement as the dashboard — /api/stats is timezone-dependent too.
  statsAll: () => ['stats'] as const,
  stats: (tzOffset: number) => ['stats', tzOffset] as const,
} as const
