const TTL_SHORT_MS = 5 * 60 * 1000        // 5 min — real-time data (stats, activity)
const TTL_LONG_MS  = 24 * 60 * 60 * 1000  // 24 h  — stable data (books, user)

const SHORT_TTL_KEYS = new Set(['stats', 'activity'])

function ttlFor(key: string): number {
  return SHORT_TTL_KEYS.has(key) ? TTL_SHORT_MS : TTL_LONG_MS
}

export function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(`cache:${key}`, JSON.stringify({ data, cachedAt: Date.now() }))
  } catch {}
}

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`cache:${key}`)
    if (!raw) return null
    const { data, cachedAt } = JSON.parse(raw)
    if (Date.now() - cachedAt > ttlFor(key)) return null
    return data as T
  } catch {
    return null
  }
}

export function invalidateCache(...keys: string[]): void {
  for (const k of keys) {
    try { localStorage.removeItem(`cache:${k}`) } catch {}
  }
}

// Named invalidation functions — callers use domain operations, not cache key strings.
// Add any new dependent keys here; call sites stay unchanged.

export function invalidateProgress(): void {
  invalidateCache('activity', 'stats')
}

export function invalidateCycle(): void {
  invalidateCache('cycles', 'stats', 'books', 'activity')
}
