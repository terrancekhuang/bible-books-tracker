// Central query-key factory — every cache key in the app is defined here, so
// mutations invalidate by calling a function rather than retyping a key array.
// Later milestones append dashboard/cycles/favorites keys here.
export const queryKeys = {
  books: () => ['books'] as const,
  currentUser: () => ['auth', 'me'] as const,
} as const
