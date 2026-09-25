import { useCallback, useEffect, useRef, useState } from 'react'
import { useSyncContext } from '../lib/SyncContext'
import { isStandalone } from '../lib/pwa'
import { CloudCheckIcon, CloudOffIcon, CloudPendingIcon, RefreshIcon, CheckCircleIcon } from './Icons'
import { useTooltip } from '../lib/useTooltip'

interface SyncIndicatorProps {
  secondaryText: string
}

export default function SyncIndicator({ secondaryText }: SyncIndicatorProps) {
  const [isPWA] = useState(isStandalone)
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

  let icon: React.ReactNode
  let label: string
  let color: string

  if (showUpToDate && !isSyncing && pendingCount === 0) {
    icon = <CheckCircleIcon size={18} />
    label = 'Up to date'
    color = 'rgba(74, 222, 128, 0.9)'
  } else if (isSyncing) {
    icon = (
      <span className="inline-flex animate-spin">
        <RefreshIcon size={18} />
      </span>
    )
    label = 'Syncing…'
    color = 'rgba(251, 191, 36, 0.9)'
  } else if (!isOnline) {
    icon = <CloudOffIcon size={18} />
    label = pendingCount > 0
      ? `Offline — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} will sync when reconnected`
      : 'Offline'
    color = 'rgba(248, 113, 113, 0.85)'
  } else if (pendingCount > 0) {
    icon = <CloudPendingIcon size={18} />
    label = `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending — tap to sync`
    color = 'rgba(251, 191, 36, 0.9)'
  } else {
    icon = <CloudCheckIcon size={18} />
    label = 'Up to date'
    color = secondaryText
  }

  const syncTooltip = useTooltip(label)

  if (!isPWA) return null

  return (
    <>
      <button
        onClick={syncNow}
        onMouseEnter={syncTooltip.onMouseEnter}
        onMouseLeave={syncTooltip.onMouseLeave}
        className="p-1.5 rounded-lg transition-colors leading-[0]"
        style={{ color }}
        aria-label={label}
      >
        {icon}
      </button>
      {syncTooltip.tooltip}
    </>
  )
}
