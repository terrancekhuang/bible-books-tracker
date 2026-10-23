import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from './Skeleton'
import { formatChapters, parseLocalDate } from '../lib/historyLogic'
import type { HistoryDay } from '../lib/historyLogic'

// The pieces Profile's Recent Reading and the History page share: one day's row, and the
// loading, empty and error states each shows in that row's place.

const dimText = 'rgba(35,31,26,0.7)'
const rule = '1px solid rgba(182,169,142,0.6)'

export function HistoryDayRow({ day, style }: { day: HistoryDay; style?: CSSProperties }) {
  const date = parseLocalDate(day.date)
  return (
    <div data-day={day.date} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: rule, ...style }}>
      <div style={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
        <div className="slab" style={{ fontSize: 20, lineHeight: 1 }}>{date.getDate()}</div>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: dimText, marginTop: 3 }}>
          {date.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {day.books.map(b => (
          <span
            key={b.book}
            style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(35,31,26,0.07)', fontSize: 13, fontWeight: 600 }}
          >
            {b.book} {formatChapters(b.chapters)}
          </span>
        ))}
      </div>
      <span style={{ fontSize: 12, color: dimText, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {day.chapters} ch
      </span>
    </div>
  )
}

export function HistorySkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" aria-label="Loading reading history">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: rule }}>
          <Skeleton className="h-9 w-10 shrink-0" />
          <Skeleton className="h-6 flex-1" />
        </div>
      ))}
    </div>
  )
}

export function HistoryEmpty() {
  return (
    <div className="text-center py-6">
      <p className="text-sm" style={{ color: dimText }}>No chapters logged yet</p>
      <Link
        to="/tracker"
        className="inline-block text-xs font-semibold uppercase mt-3 px-4 py-2 rounded-lg transition-colors"
        style={{ letterSpacing: '0.08em', color: 'var(--color-ink)', border: '1px solid rgba(35,31,26,0.3)' }}
      >
        Open the Tracker
      </Link>
    </div>
  )
}

export function HistoryError({ message = "Couldn't load your reading history.", onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="text-center py-6" role="alert">
      <p className="text-sm" style={{ color: dimText }}>{message}</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold uppercase mt-3 px-4 py-2 rounded-lg transition-colors"
        style={{ letterSpacing: '0.08em', color: 'var(--color-ink)', border: '1px solid rgba(35,31,26,0.3)' }}
      >
        Try again
      </button>
    </div>
  )
}
