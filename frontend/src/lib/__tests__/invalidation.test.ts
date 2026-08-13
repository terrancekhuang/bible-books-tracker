import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  invalidateProgressWrite,
  invalidateCycleCreated,
  invalidateQueueFlushed,
} from '../invalidation'
import { queryKeys } from '../queryKeys'

// The fan-out is the thing that goes wrong quietly: a write that forgets a key leaves a
// page stale with no error anywhere. These tests pin the exact key set of each
// operation, so adding a query without wiring it up is a visible failure here.

const TZ_OFFSET = -300

/** Every key a write might touch, pre-populated so invalidation has something to mark. */
const KEYS = {
  books: queryKeys.books(),
  cycles: queryKeys.cycles(),
  favorites: queryKeys.favorites(),
  dashboard: queryKeys.dashboard(TZ_OFFSET),
  stats: queryKeys.stats(TZ_OFFSET),
  currentUser: queryKeys.currentUser(),
} as const

const FRESH_BOOKS = [{ name: 'Genesis', chapters_read: 0 }]

let queryClient: QueryClient
let booksResponse: Promise<unknown>
let booksFetches: number

/**
 * The names of the seeded queries the operation marked stale.
 *
 * Note `books` only shows up here when it was invalidated *without* being refetched —
 * a completed refetch clears the flag. `booksFetches` is what proves the refetch.
 */
function invalidated(): string[] {
  return Object.entries(KEYS)
    .filter(([, key]) => queryClient.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort()
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  booksResponse = Promise.resolve(FRESH_BOOKS)
  booksFetches = 0
  // Defaults have to be registered before the query exists — a query binds its options
  // when it's created, so a later setQueryDefaults would never reach it.
  queryClient.setQueryDefaults(queryKeys.books(), {
    queryFn: () => { booksFetches++; return booksResponse },
  })
  // Nothing observes any of these, so invalidation alone won't refetch them.
  for (const key of Object.values(KEYS)) queryClient.setQueryData(key, { seeded: true })
})

describe('invalidateProgressWrite', () => {
  it('marks only the derived views stale', () => {
    invalidateProgressWrite(queryClient)

    // Books is absent on purpose: submit/undo/reset patch the book straight into the
    // cache from the server's response, so refetching the grid would be wasted work.
    expect(invalidated()).toEqual(['dashboard', 'stats'])
    expect(booksFetches).toBe(0)
  })

  // Both keys carry a timezone offset, so a prefix match is what reaches whichever
  // variant a mounted page is actually using.
  it('invalidates by prefix, matching every timezone variant', () => {
    queryClient.setQueryData(queryKeys.dashboard(60), { seeded: true })
    queryClient.setQueryData(queryKeys.stats(60), { seeded: true })

    invalidateProgressWrite(queryClient)

    for (const key of [queryKeys.dashboard(60), queryKeys.stats(60)]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    }
  })
})

describe('invalidateCycleCreated', () => {
  it('marks every cycle-derived view stale', async () => {
    await invalidateCycleCreated(queryClient)

    // Books is missing from this list precisely because it was refetched — see below.
    expect(invalidated()).toEqual(['cycles', 'dashboard', 'stats'])
  })

  // The reason this one is awaited at all: Profile navigates to Tracker the moment it
  // resolves, and nothing on Profile observes `books`. Without refetchType: 'all' the
  // await would resolve without fetching and Tracker would paint the finished cycle.
  it('refetches the book grid even though nothing is observing it', async () => {
    await invalidateCycleCreated(queryClient)

    expect(booksFetches).toBe(1)
    expect(queryClient.getQueryData(queryKeys.books())).toEqual(FRESH_BOOKS)
  })

  it('does not resolve until the fresh grid has arrived', async () => {
    let deliverBooks: (books: unknown) => void = () => {}
    booksResponse = new Promise(resolve => { deliverBooks = resolve })

    let settled = false
    const pending = invalidateCycleCreated(queryClient).then(() => { settled = true })

    await Promise.resolve()
    expect(settled).toBe(false)

    deliverBooks(FRESH_BOOKS)
    await pending
    expect(settled).toBe(true)
  })
})

describe('invalidateQueueFlushed', () => {
  it('marks the book grid stale too, since replayed writes bypass the cache patch', () => {
    invalidateQueueFlushed(queryClient)

    // Unlike cycle creation this doesn't force a refetch of an unobserved grid: whichever
    // page is mounted refetches its own queries, and Tracker picks the grid up on mount.
    expect(invalidated()).toEqual(['books', 'cycles', 'dashboard', 'stats'])
  })

  // Neither is written to anywhere in this redesign; refetching them would be noise.
  it('leaves favorites and the current user alone', () => {
    invalidateQueueFlushed(queryClient)

    expect(invalidated()).not.toContain('favorites')
    expect(invalidated()).not.toContain('currentUser')
  })
})
