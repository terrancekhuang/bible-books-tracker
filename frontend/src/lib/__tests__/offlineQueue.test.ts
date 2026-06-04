import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { enqueueWrite, getPendingCount, flushQueue } from '../offlineQueue'

const URL = '/api/progress'
const METHOD = 'POST'
const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer token' }
const BODY = JSON.stringify({ book_name: 'Genesis', chapters: [1] })

function okResponse(status = 200): Response {
  return { ok: true, status } as Response
}

function errorResponse(status: number): Response {
  return { ok: false, status } as Response
}

beforeEach(() => {
  // Fresh IndexedDB per test — no leftover pending writes
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getPendingCount', () => {
  it('returns 0 on an empty queue', async () => {
    expect(await getPendingCount()).toBe(0)
  })
})

describe('enqueueWrite', () => {
  it('adds one item to the queue', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    expect(await getPendingCount()).toBe(1)
  })

  it('adds multiple items in sequence', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, 'body1')
    await enqueueWrite(URL, METHOD, HEADERS, 'body2')
    expect(await getPendingCount()).toBe(2)
  })
})

describe('flushQueue', () => {
  it('does nothing when queue is empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await flushQueue(vi.fn())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('replays a pending write and removes it on success', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()))
    await flushQueue(vi.fn())
    expect(await getPendingCount()).toBe(0)
  })

  it('discards a 4xx item (permanent error)', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(422)))
    await flushQueue(vi.fn())
    expect(await getPendingCount()).toBe(0)
  })

  it('keeps the item and stops on 5xx (transient error)', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(503)))
    await flushQueue(vi.fn())
    expect(await getPendingCount()).toBe(1)
  })

  it('keeps the item and stops on network error', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await flushQueue(vi.fn())
    expect(await getPendingCount()).toBe(1)
  })

  it('calls onLogout on 401', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(401)))
    const onLogout = vi.fn()
    await flushQueue(onLogout)
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('does not remove item on 401 (onLogout called instead)', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(401)))
    await flushQueue(vi.fn())
    expect(await getPendingCount()).toBe(1)
  })

  it('replays multiple items in order', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, 'body1')
    await enqueueWrite(URL, METHOD, HEADERS, 'body2')

    const replayed: string[] = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, opts: RequestInit) => {
      replayed.push(opts.body as string)
      return Promise.resolve(okResponse())
    }))

    await flushQueue(vi.fn())
    expect(replayed).toEqual(['body1', 'body2'])
    expect(await getPendingCount()).toBe(0)
  })

  it('stops after first 5xx and leaves remaining items', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, 'body1')
    await enqueueWrite(URL, METHOD, HEADERS, 'body2')

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(errorResponse(503)),
    )

    await flushQueue(vi.fn())
    expect(await getPendingCount()).toBe(1) // second item survives
  })

  it('prevents concurrent flush execution', async () => {
    await enqueueWrite(URL, METHOD, HEADERS, BODY)

    let callCount = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++
      return new Promise<Response>(resolve =>
        setTimeout(() => resolve(okResponse()), 20),
      )
    }))

    const p1 = flushQueue(vi.fn())
    const p2 = flushQueue(vi.fn()) // should return immediately — flushing already in progress
    await Promise.all([p1, p2])

    expect(callCount).toBe(1)
  })
})
