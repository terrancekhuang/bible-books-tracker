import { useState } from 'react'
import { useSyncStatus } from '../lib/useSyncStatus'
import { CloudCheckIcon, CloudOffIcon, CloudPendingIcon, RefreshIcon, CheckCircleIcon } from './Icons'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

interface SyncIndicatorProps {
  secondaryText: string
}

export default function SyncIndicator({ secondaryText }: SyncIndicatorProps) {
  const [isPWA] = useState(isStandalone)
  const { isOnline, pendingCount, isSyncing, showUpToDate, syncNow } = useSyncStatus()

  if (!isPWA) return null

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

  return (
    <button
      onClick={syncNow}
      className="p-1.5 rounded-lg transition-colors leading-[0]"
      style={{ color }}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  )
}
