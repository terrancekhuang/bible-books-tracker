import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  createSubmitMutationOptions,
  createUndoMutationOptions,
  createResetMutationOptions,
  type MutationDeps,
} from '../trackerMutations'
import { queryKeys } from '../queryKeys'
import type { Book } from '../trackerLogic'

// cache.ts is a localStorage-backed legacy bridge — mock it wholesale so these tests
// stay in the node environment, and so the bridge call is assertable.
vi.mock('../cache', () => ({
  invalidateProgress: vi.fn(),
}))
import { invalidateProgress } from '../cache'

const TZ_OFFSET = -300

const GENESIS: Book = {
  book_id: 1,
  name: 'Genesis',
  testament: 'Old',
  category: 'Law',
  num_chapters: 50,
  chapters_read: 2,
  chapters_read_list: [1, 2],
  last_read_at: '2026-01-01T00:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

let queryClient: QueryClient
let deps: MutationDeps
let patchBook: ReturnType<typeof vi.fn<(name: string, book: Book) => void>>
let logout: ReturnType<typeof vi.fn<() => void>>
let enqueue: ReturnType<typeof vi.fn<(url: string, method: string, headers: Record<string, string>, body: string) => Promise<void>>>

/** The book as the TanStack cache currently holds it. */
function cachedBook(name = 'Genesis'): Book | undefined {
  return queryClient.getQueryData<Book[]>(queryKeys.books())?.find(b => b.name === name)
}

/**
 * Whether the write told the dashboard query it was out of date. Checked against real
 * cache state rather than a spy, so this also proves the write's prefix invalidation
 * reaches a dashboard keyed by a specific timezone offset.
 */
function invalidatedDashboard(): boolean {
  return queryClient.getQueryState(queryKeys.dashboard(TZ_OFFSET))?.isInvalidated ?? false
}

/** The same, for the stats query Profile reads. */
function invalidatedStats(): boolean {
  return queryClient.getQueryState(queryKeys.stats(TZ_OFFSET))?.isInvalidated ?? false
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData<Book[]>(queryKeys.books(), [GENESIS])
  // Dashboard and stats entries for the invalidated*() helpers to observe. Nothing
  // subscribes to them, so invalidating only marks them stale — no refetch fires here.
  queryClient.setQueryData(queryKeys.dashboard(TZ_OFFSET), { weekly_goal: 7 })
  queryClient.setQueryData(queryKeys.stats(TZ_OFFSET), { total_chapters: 120 })

  patchBook = vi.fn<(name: string, book: Book) => void>()
  logout = vi.fn<() => void>()
  enqueue = vi.fn<(url: string, method: string, headers: Record<string, string>, body: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  deps = { queryClient, patchBook, logout, enqueue }

  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('submit', () => {
  it('optimistically adds chapters, then reconciles to the server response', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [3, 4] }

    const context = await options.onMutate(vars)

    // Optimistic: union of existing and submitted chapters, written to both caches
    expect(cachedBook()?.chapters_read_list).toEqual([1, 2, 3, 4])
    expect(cachedBook()?.chapters_read).toBe(4)
    expect(patchBook).toHaveBeenCalledWith('Genesis', expect.objectContaining({ chapters_read: 4 }))
    expect(context.previousBook).toBe(GENESIS)
    expect(context.newlyLoggedOptimistic).toBe(2)

    // Server confirms a different total than we guessed — the server wins
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: true, chapters_read: 5, chapters_read_list: [1, 2, 3, 4, 5], newly_logged: 2 })
    ))
    const result = await options.mutationFn(vars)
    expect(result).toMatchObject({ status: 'confirmed', chapters_read: 5 })

    await options.onSuccess(result, vars, context)
    expect(cachedBook()?.chapters_read_list).toEqual([1, 2, 3, 4, 5])
    expect(invalidateProgress).toHaveBeenCalled()
    expect(invalidatedDashboard()).toBe(true)
    expect(invalidatedStats()).toBe(true)
  })

  // The bug this redesign exists to fix: a confirmed write has to reach a Dashboard or
  // Profile that was already mounted, without relying on a global event.
  it('invalidates the derived views even when only the optimistic guess logged anything', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [3] }
    const context = await options.onMutate(vars)
    expect(context.newlyLoggedOptimistic).toBe(1)

    vi.stubGlobal('fetch', vi.fn())
    await options.onSuccess(
      { status: 'confirmed', chapters_read: 2, chapters_read_list: [1, 2], newly_logged: 0 },
      vars,
      context,
    )

    expect(invalidatedDashboard()).toBe(true)
    expect(invalidatedStats()).toBe(true)
  })

  it('deduplicates chapters that were already read', async () => {
    const options = createSubmitMutationOptions(deps)
    const context = await options.onMutate({ book: GENESIS, chapters: [2, 3] })

    expect(cachedBook()?.chapters_read_list).toEqual([1, 2, 3])
    expect(context.newlyLoggedOptimistic).toBe(1)
  })

  it('queues the write and keeps the optimistic state when offline', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [3] }
    await options.onMutate(vars)

    vi.stubGlobal('navigator', { onLine: false })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await options.mutationFn(vars)

    expect(result).toEqual({ status: 'queued' })
    expect(enqueue).toHaveBeenCalledWith('/api/progress', 'POST', expect.anything(), JSON.stringify({ book_name: 'Genesis', chapters: [3] }))
    // Critical: no throw means onError never runs, so the optimistic update survives
    // until the queue replays it on reconnect.
    expect(cachedBook()?.chapters_read_list).toEqual([1, 2, 3])
  })

  it('queues on a network-level failure even while nominally online', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [3] }
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    expect(await options.mutationFn(vars)).toEqual({ status: 'queued' })
    expect(enqueue).toHaveBeenCalled()
  })

  it('rolls back to the pre-write book on a genuine server error', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [3] }
    const context = await options.onMutate(vars)
    expect(cachedBook()?.chapters_read).toBe(3)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, error: 'boom' }, 500)))
    await expect(options.mutationFn(vars)).rejects.toThrow('boom')

    options.onError(new Error('boom'), vars, context)
    expect(cachedBook()).toEqual(GENESIS)
    expect(patchBook).toHaveBeenLastCalledWith('Genesis', GENESIS)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('logs out on 401 without rolling back or queueing', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [3] }
    const context = await options.onMutate(vars)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)))
    const result = await options.mutationFn(vars)

    expect(result).toEqual({ status: 'auth-failed' })
    expect(logout).toHaveBeenCalled()
    expect(enqueue).not.toHaveBeenCalled()

    // A non-confirmed result is a no-op for the cache
    await options.onSuccess(result, vars, context)
    expect(cachedBook()?.chapters_read_list).toEqual([1, 2, 3])
    expect(invalidateProgress).not.toHaveBeenCalled()
    expect(invalidatedDashboard()).toBe(false)
    expect(invalidatedStats()).toBe(false)
  })

  it('skips the refresh when nothing new was actually logged', async () => {
    const options = createSubmitMutationOptions(deps)
    const vars = { book: GENESIS, chapters: [1, 2] }
    const context = await options.onMutate(vars)
    expect(context.newlyLoggedOptimistic).toBe(0)

    vi.stubGlobal('fetch', vi.fn())
    await options.onSuccess(
      { status: 'confirmed', chapters_read: 2, chapters_read_list: [1, 2], newly_logged: 0 },
      vars,
      context,
    )

    expect(invalidateProgress).not.toHaveBeenCalled()
    expect(invalidatedDashboard()).toBe(false)
    expect(invalidatedStats()).toBe(false)
  })
})

describe.each([
  ['undo', createUndoMutationOptions],
  ['reset', createResetMutationOptions],
] as const)('%s', (_label, createOptions) => {
  it('patches the book only after the server responds', async () => {
    const options = createOptions(deps)
    const vars = { book: GENESIS }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: true, chapters_read: 1, chapters_read_list: [1] })
    ))
    const data = await options.mutationFn(vars)

    // Not optimistic — nothing has changed yet at this point
    expect(cachedBook()).toEqual(GENESIS)

    await options.onSuccess(data, vars)
    expect(cachedBook()?.chapters_read_list).toEqual([1])
    expect(patchBook).toHaveBeenCalledWith('Genesis', expect.objectContaining({ chapters_read: 1 }))
    expect(invalidateProgress).toHaveBeenCalled()
    expect(invalidatedDashboard()).toBe(true)
    expect(invalidatedStats()).toBe(true)
  })

  it('does nothing when the server reports no change', async () => {
    const options = createOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false })))

    const data = await options.mutationFn({ book: GENESIS })
    await options.onSuccess(data, { book: GENESIS })

    expect(cachedBook()).toEqual(GENESIS)
    expect(patchBook).not.toHaveBeenCalled()
    expect(invalidateProgress).not.toHaveBeenCalled()
    expect(invalidatedDashboard()).toBe(false)
    expect(invalidatedStats()).toBe(false)
  })

  it('logs out on 401 and leaves the cache untouched', async () => {
    const options = createOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)))

    const data = await options.mutationFn({ book: GENESIS })
    expect(data).toBeNull()
    expect(logout).toHaveBeenCalled()

    await options.onSuccess(data, { book: GENESIS })
    expect(cachedBook()).toEqual(GENESIS)
  })

  it('leaves the cache untouched on a network error', async () => {
    const options = createOptions(deps)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(options.mutationFn({ book: GENESIS })).rejects.toThrow()

    options.onError(new Error('Failed to fetch'))
    expect(cachedBook()).toEqual(GENESIS)
    expect(patchBook).not.toHaveBeenCalled()
  })
})
