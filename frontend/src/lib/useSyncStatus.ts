import { useCallback, useEffect, useRef, useState } from 'react'
import { useSyncContext } from './SyncContext'

export function useSyncStatus() {
  const { isOnline, pendingCount, syncNow: doSync } = useSyncContext()

  const [isSyncing, setIsSyncing] = useState(false)
  const [showUpToDate, setShowUpToDate] = useState(false)
  const upToDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (upToDateTimerRef.current !== null) clearTimeout(upToDateTimerRef.current)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      await doSync()
      if (upToDateTimerRef.current !== null) clearTimeout(upToDateTimerRef.current)
      setShowUpToDate(true)
      upToDateTimerRef.current = setTimeout(() => setShowUpToDate(false), 2000)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, doSync])

  return { isOnline, pendingCount, isSyncing, showUpToDate, syncNow }
}
