const TTL_MS = 24 * 60 * 60 * 1000

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
    if (Date.now() - cachedAt > TTL_MS) return null
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
