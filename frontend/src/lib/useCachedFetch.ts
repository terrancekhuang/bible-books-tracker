import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getCache, setCache } from './cache'
import { fetchJson } from './api'

interface Options {
  refetchOnOnline?: boolean
}

export function useCachedFetch<T>(
  cacheKey: string,
  url: string,
  { refetchOnOnline = false }: Options = {}
): { data: T | null; loading: boolean; error: boolean; refetch: () => Promise<void> } {
  const { logout } = useAuth()

  const [data, setData] = useState<T | null>(() => getCache<T>(cacheKey))
  // loading is true only when we have no data yet — background refetches don't show a spinner
  const [loading, setLoading] = useState(() => getCache<T>(cacheKey) === null)
  const [error, setError] = useState(false)

  const run = useCallback(async () => {
    const result = await fetchJson<T>(url, logout)
    if (result.ok) {
      setData(result.data)
      setCache(cacheKey, result.data)
      setError(false)
    } else if (!result.unauthorized) {
      setError(true)
    }
    setLoading(false)
  }, [cacheKey, url, logout])

  useEffect(() => {
    run()
    if (refetchOnOnline) {
      window.addEventListener('online', run)
      window.addEventListener('books-invalidated', run)
      return () => {
        window.removeEventListener('online', run)
        window.removeEventListener('books-invalidated', run)
      }
    }
  }, [run, refetchOnOnline])

  return { data, loading, error, refetch: run }
}
