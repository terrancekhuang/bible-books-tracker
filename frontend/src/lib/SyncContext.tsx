import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { enqueueWrite, flushQueue, getPendingCount } from './offlineQueue'
import { invalidateCycle } from './cache'
import { invalidateQueueFlushed } from './invalidation'

interface SyncContextValue {
  isOnline: boolean
  pendingCount: number
  enqueue: (url: string, method: string, headers: Record<string, string>, body: string) => Promise<void>
  syncNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const queryClient = useQueryClient()

  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  const doFlush = useCallback(async (): Promise<void> => {
    await flushQueue(logout)
    const n = await getPendingCount()
    setPendingCount(n)
    // Only once the queue is fully drained — a partial flush (a 5xx stops the replay)
    // leaves writes outstanding, so the views would only go stale again.
    if (n === 0) {
      invalidateQueueFlushed(queryClient)
      // LEGACY BRIDGE: keeps cache:books — the books query's reload seed — accurate,
      // via the refetch this triggers in BooksProvider. Goes with cache.ts in milestone 4.
      invalidateCycle()
      window.dispatchEvent(new CustomEvent('books-invalidated'))
    }
  }, [logout, queryClient])

  // On mount: read queue depth; flush immediately if online and non-empty
  useEffect(() => {
    getPendingCount().then(n => {
      setPendingCount(n)
      if (navigator.onLine && n > 0) doFlush()
    })
  }, [doFlush])

  // Reconnect / disconnect
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); doFlush() }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [doFlush])

  // Tab regains focus: another device may have written since we last fetched
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        window.dispatchEvent(new CustomEvent('books-invalidated'))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const enqueue = useCallback(async (
    url: string, method: string, headers: Record<string, string>, body: string,
  ): Promise<void> => {
    await enqueueWrite(url, method, headers, body)
    const n = await getPendingCount()
    setPendingCount(n)
  }, [])

  const syncNow = useCallback(async (): Promise<void> => {
    if (isOnline) await doFlush()
  }, [isOnline, doFlush])

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, enqueue, syncNow }}>
      {children}
    </SyncContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider')
  return ctx
}
