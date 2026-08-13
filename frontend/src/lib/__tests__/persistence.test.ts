import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { queryKeys } from '../queryKeys'
import type { MutationState } from '@tanstack/react-query'
import type { Book } from '../trackerLogic'

/**
 * The persister is what replaced the old localStorage cache as the thing that paints a
 * page instantly on reload. These tests pin the three properties the app depends on:
 * a query round-trips, a stale-shaped cache is discarded rather than hydrated, and
 * mutations never travel — offlineQueue.ts is the one durable owner of a pending write.
 */

const BUSTER = 'v1'
const DAY_MS = 24 * 60 * 60 * 1000

const GENESIS = {
  book_id: 1,
  name: 'Genesis',
  testament: 'Old',
  category: 'Law',
  num_chapters: 50,
  chapters_read: 5,
  chapters_read_list: [1, 2, 3, 4, 5],
  last_read_at: '2026-01-01T00:00:00.000Z',
} satisfies Book

/** A localStorage stand-in — the tests run in the node environment, with no DOM. */
function stubStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

let storage: ReturnType<typeof stubStorage>
let persister: ReturnType<typeof createSyncStoragePersister>

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: DAY_MS } } })
}

/**
 * The sync persister throttles its writes through a setTimeout, so even at throttleTime 0
 * the storage is written a macrotask after the save call returns. Without this wait every
 * assertion below would pass against an empty cache.
 */
function flushThrottle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function save(source: QueryClient): Promise<void> {
  await persistQueryClientSave({
    queryClient: source,
    persister,
    buster: BUSTER,
    dehydrateOptions: { shouldDehydrateMutation: () => false },
  })
  await flushThrottle()
}

function persistedMutations(): unknown[] {
  const raw = storage.getItem('bible-tracker-query-cache')
  expect(raw).not.toBeNull()
  return JSON.parse(raw!).clientState.mutations
}

/** Writes `source`'s cache out and hydrates a fresh client from it, as a reload does. */
async function roundTrip(source: QueryClient, restoreOptions = {}): Promise<QueryClient> {
  await save(source)
  const restored = newClient()
  await persistQueryClientRestore({
    queryClient: restored,
    persister,
    maxAge: DAY_MS,
    buster: BUSTER,
    ...restoreOptions,
  })
  return restored
}

beforeEach(() => {
  storage = stubStorage()
  persister = createSyncStoragePersister({ storage, key: 'bible-tracker-query-cache', throttleTime: 0 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('cache persistence', () => {
  it('restores successful queries, so the next load paints from them', async () => {
    const client = newClient()
    client.setQueryData<Book[]>(queryKeys.books(), [GENESIS])
    client.setQueryData(queryKeys.cycles(), [{ cycle_id: 1, cycle_number: 1 }])

    const restored = await roundTrip(client)

    expect(restored.getQueryData<Book[]>(queryKeys.books())).toEqual([GENESIS])
    expect(restored.getQueryData(queryKeys.cycles())).toEqual([{ cycle_id: 1, cycle_number: 1 }])
  })

  it('discards the whole cache when the buster does not match', async () => {
    const client = newClient()
    client.setQueryData<Book[]>(queryKeys.books(), [GENESIS])

    // What a deploy that changed a payload's shape looks like to a returning user.
    const restored = await roundTrip(client, { buster: 'v2' })

    expect(restored.getQueryData(queryKeys.books())).toBeUndefined()
  })

  it('discards a cache older than maxAge', async () => {
    const client = newClient()
    client.setQueryData<Book[]>(queryKeys.books(), [GENESIS])

    const restored = await roundTrip(client, { maxAge: -1 })

    expect(restored.getQueryData(queryKeys.books())).toBeUndefined()
  })

  it('never persists mutations, leaving the offline queue the only durable copy', async () => {
    const client = newClient()
    // A paused mutation is precisely what TanStack's default would persist and replay on
    // reconnect. offlineQueue.ts already holds this write in IndexedDB, so persisting it
    // here too would submit the same chapters twice.
    const paused: MutationState = {
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: 'pending',
      submittedAt: Date.now(),
      variables: { book_name: 'Genesis', chapters: [6] },
    }
    client.getMutationCache().build(client, { mutationKey: ['submit'] }, paused)

    // Positive control: the default would carry it across a reload.
    await persistQueryClientSave({ queryClient: client, persister, buster: BUSTER })
    await flushThrottle()
    expect(persistedMutations()).toHaveLength(1)

    await save(client)
    expect(persistedMutations()).toEqual([])
  })
})
