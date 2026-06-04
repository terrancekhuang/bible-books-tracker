import { useCallback, useEffect, useState } from 'react'
import { authHeaders } from './auth'
import { useAuth } from './AuthContext'
import { flushQueue } from './offlineQueue'
import { getCache, setCache } from './cache'

interface Options {
  flushOfflineQueue?: boolean
  refetchOnOnline?: boolean
}

export function useCachedFetch<T>(
  cacheKey: string,
  url: string,
  { flushOfflineQueue = false, refetchOnOnline = false }: Options = {}
): { data: T | null; loading: boolean; error: boolean; refetch: () => Promise<void> } {
  const { logout } = useAuth()

  const [data, setData] = useState<T | null>(() => getCache<T>(cacheKey))
  // loading is true only when we have no data yet — background refetches don't show a spinner
  const [loading, setLoading] = useState(() => getCache<T>(cacheKey) === null)
  const [error, setError] = useState(false)

  const run = useCallback(async () => {
    try {
      if (flushOfflineQueue && navigator.onLine) await flushQueue(logout)
      const res = await fetch(url, { headers: authHeaders() })
      if (res.status === 401) { logout(); return }
      if (!res.ok) { setError(true); return }
      const json = await res.json() as T
      setData(json)
      setCache(cacheKey, json)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, url, logout, flushOfflineQueue])

  useEffect(() => {
    run()
    if (refetchOnOnline) {
      window.addEventListener('online', run)
      return () => window.removeEventListener('online', run)
    }
  }, [run, refetchOnOnline])

  return { data, loading, error, refetch: run }
}
