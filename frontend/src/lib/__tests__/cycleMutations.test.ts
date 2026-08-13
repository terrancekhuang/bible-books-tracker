import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createCreateCycleMutationOptions, type CycleMutationDeps } from '../cycleMutations'
import { queryKeys } from '../queryKeys'

const TZ_OFFSET = -300

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

// normalizeBook fills these two in, so the fixtures carry them.
const FINISHED_CYCLE_BOOKS = [{ name: 'Genesis', chapters_read: 50, chapters_read_list: [1], last_read_at: null }]
const NEW_CYCLE_BOOKS = [{ name: 'Genesis', chapters_read: 0, chapters_read_list: [], last_read_at: null }]

let queryClient: QueryClient
let deps: CycleMutationDeps
let logout: ReturnType<typeof vi.fn<() => void>>
let booksResponse: Promise<unknown>

/**
 * Which of the seeded queries the mutation marked stale. `books` is deliberately absent
 * from the success case: it gets refetched outright, which clears the flag — the fresh
 * grid itself is the assertion there.
 */
function invalidated(): string[] {
  const keys = {
    books: queryKeys.books(),
    cycles: queryKeys.cycles(),
    dashboard: queryKeys.dashboard(TZ_OFFSET),
    stats: queryKeys.stats(TZ_OFFSET),
  }
  return Object.entries(keys)
    .filter(([, key]) => queryClient.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort()
}

function cachedBooks(): unknown {
  return queryClient.getQueryData(queryKeys.books())
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  booksResponse = Promise.resolve(NEW_CYCLE_BOOKS)
  // The finished cycle's state, as a mounted app would still be holding it. Note this
  // query has no queryFn — the shape a persisted query is restored with.
  queryClient.setQueryData(queryKeys.books(), FINISHED_CYCLE_BOOKS)
  queryClient.setQueryData(queryKeys.cycles(), [{ cycle_id: 1, cycle_number: 1 }])
  queryClient.setQueryData(queryKeys.dashboard(TZ_OFFSET), { weekly_goal: 7 })
  queryClient.setQueryData(queryKeys.stats(TZ_OFFSET), { total_chapters: 120 })

  logout = vi.fn<() => void>()
  deps = { queryClient, logout }

  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  stubFetch(jsonResponse({ cycle_id: 2, cycle_number: 2 }))
})

/** Routes the two endpoints this mutation touches; anything else is a test bug. */
function stubFetch(cycleResponse: Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/books')) {
      return { ok: true, status: 200, json: async () => await booksResponse } as Response
    }
    return cycleResponse
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('createCycle', () => {
  it('returns the cycle the server assigned', async () => {
    const options = createCreateCycleMutationOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ cycle_id: 2, cycle_number: 2 })))

    expect(await options.mutationFn()).toEqual({ cycle_id: 2, cycle_number: 2 })
  })

  it('leaves the cache untouched until the server responds', async () => {
    const options = createCreateCycleMutationOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ cycle_id: 2, cycle_number: 2 })))

    await options.mutationFn()

    // Not optimistic — the server owns the cycle number, and there is nothing useful to
    // show before it answers. Same asymmetry as undo/reset.
    expect(invalidated()).toEqual([])
    expect(cachedBooks()).toEqual(FINISHED_CYCLE_BOOKS)
  })

  it('refreshes the book grid and invalidates every cycle-derived view on success', async () => {
    const options = createCreateCycleMutationOptions(deps)

    await options.onSuccess({ cycle_id: 2, cycle_number: 2 })

    expect(cachedBooks()).toEqual(NEW_CYCLE_BOOKS)
    expect(invalidated()).toEqual(['cycles', 'dashboard', 'stats'])
  })

  // The books query has no observers here, which is the real case: the user is on
  // Profile, so nothing is rendering the grid. A default invalidation only refetches
  // *active* queries and would resolve without fetching, leaving the persisted finished
  // cycle to paint when Tracker mounts. refetchType: 'all' is what prevents that.
  it('refetches the book grid even though nothing is observing it', async () => {
    const options = createCreateCycleMutationOptions(deps)
    expect(queryClient.getQueryCache().find({ queryKey: queryKeys.books() })?.getObserversCount())
      .toBe(0)

    await options.onSuccess({ cycle_id: 2, cycle_number: 2 })

    expect(cachedBooks()).toEqual(NEW_CYCLE_BOOKS)
  })

  // Profile navigates to Tracker as soon as this resolves, so the grid has to be fresh
  // by then rather than merely marked stale — otherwise Tracker's first paint is the
  // cycle the user just finished.
  it('does not resolve until the fresh book grid has arrived', async () => {
    const options = createCreateCycleMutationOptions(deps)
    let deliverBooks: (books: unknown) => void = () => {}
    booksResponse = new Promise(resolve => { deliverBooks = resolve })

    let settled = false
    const pending = options.onSuccess({ cycle_id: 2, cycle_number: 2 }).then(() => { settled = true })

    await Promise.resolve()
    expect(settled).toBe(false)
    expect(cachedBooks()).toEqual(FINISHED_CYCLE_BOOKS)

    deliverBooks(NEW_CYCLE_BOOKS)
    await pending

    expect(settled).toBe(true)
    expect(cachedBooks()).toEqual(NEW_CYCLE_BOOKS)
  })

  it('logs out on 401 and invalidates nothing', async () => {
    const options = createCreateCycleMutationOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)))

    const data = await options.mutationFn()
    expect(data).toBeNull()
    expect(logout).toHaveBeenCalled()

    // The null result is a no-op, so the caller stays put instead of navigating to a
    // Tracker it has just been logged out of.
    await options.onSuccess(data)
    expect(invalidated()).toEqual([])
    expect(cachedBooks()).toEqual(FINISHED_CYCLE_BOOKS)
  })

  it('throws on a server error, leaving every view as it was', async () => {
    const options = createCreateCycleMutationOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 500)))

    await expect(options.mutationFn()).rejects.toThrow('Failed to create cycle')

    options.onError(new Error('Failed to create cycle'))
    expect(invalidated()).toEqual([])
    expect(cachedBooks()).toEqual(FINISHED_CYCLE_BOOKS)
  })

  it('throws on a network error too', async () => {
    const options = createCreateCycleMutationOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(options.mutationFn()).rejects.toThrow()
    expect(logout).not.toHaveBeenCalled()
  })
})
