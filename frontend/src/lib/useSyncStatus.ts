import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { flushQueue, getPendingCount } from './offlineQueue'
import { invalidateCycle } from './cache'

export function useSyncStatus() {
  const { logout } = useAuth()
  const logoutRef = useRef(logout)
  logoutRef.current = logout

  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showUpToDate, setShowUpToDate] = useState(false)
  const upToDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getPendingCount().then(setPendingCount)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleCountChanged = (e: Event) => {
      setPendingCount((e as CustomEvent<number>).detail)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('pending-count-changed', handleCountChanged)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pending-count-changed', handleCountChanged)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (upToDateTimerRef.current !== null) clearTimeout(upToDateTimerRef.current)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      if (isOnline) {
        await flushQueue(logoutRef.current)
        const n = await getPendingCount()
        setPendingCount(n)
        if (n === 0) {
          invalidateCycle()
          window.dispatchEvent(new CustomEvent('books-invalidated'))
        }
      }
      if (upToDateTimerRef.current !== null) clearTimeout(upToDateTimerRef.current)
      setShowUpToDate(true)
      upToDateTimerRef.current = setTimeout(() => setShowUpToDate(false), 2000)
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing])

  return { isOnline, pendingCount, isSyncing, showUpToDate, syncNow }
}
