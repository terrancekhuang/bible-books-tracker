import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityDay } from './ActivityHeatmap'
import { calendarCells, parseLocalDate, shiftMonth } from '../lib/historyLogic'

// History's jump-to-a-date button and its month popover. Only read days can be picked;
// the arrows stop at the first month with reading and the current month.

const ink = 'var(--color-ink)'
const arrowStyle = { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink } as const

function monthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function HistoryCalendar({ activity, selected, onPick }: {
  activity: ActivityDay[]
  selected: string | null
  onPick: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const readDays = useMemo(() => new Map(activity.map(a => [a.logged_at, a.chapters])), [activity])
  const first = activity[0].logged_at.slice(0, 7)
  const latest = activity.at(-1)!.logged_at.slice(0, 7)
  const thisMonth = monthOf(new Date())
  const last = latest > thisMonth ? latest : thisMonth

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    // Esc closes only the popover; History's own Esc (clear the selection) waits for the next press.
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey, true)
    }
  }, [open])

  function toggle() {
    if (!open) setMonth(selected ? selected.slice(0, 7) : last)
    setOpen(!open)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Jump to a date"
        className="flex items-center justify-center rounded-lg"
        style={{
          width: 44, height: 44, color: ink,
          border: `1px solid ${open ? 'rgba(35,31,26,0.45)' : 'rgba(35,31,26,0.2)'}`,
          background: open ? 'rgba(35,31,26,0.08)' : 'transparent',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pick a day"
          style={{
            position: 'absolute', top: 52, right: 0, zIndex: 20, width: 252, padding: '10px 12px 12px',
            background: '#F6F1E4', borderRadius: 8,
            boxShadow: '0 12px 28px -8px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(35,31,26,0.18)',
          }}
        >
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= first} aria-label="Previous month" className="disabled:opacity-30" style={arrowStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {parseLocalDate(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= last} aria-label="Next month" className="disabled:opacity-30" style={arrowStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 text-center" style={{ marginTop: 2, fontSize: 10, color: 'rgba(35,31,26,0.7)' }} aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7" style={{ marginTop: 2 }}>
            {calendarCells(month, readDays).map((c, i) =>
              !c ? <span key={i} /> : c.chapters ? (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => { setOpen(false); onPick(c.date) }}
                  aria-label={`${parseLocalDate(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${c.chapters} chapter${c.chapters === 1 ? '' : 's'}`}
                  className="flex flex-col items-center justify-center rounded"
                  style={{ height: 32, gap: 2, fontSize: 12, fontWeight: 700, color: ink, background: c.date === selected ? 'rgba(210,166,63,0.3)' : 'transparent' }}
                >
                  {c.day}
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-leaf-red)' }} />
                </button>
              ) : (
                <span key={c.date} className="flex items-center justify-center" style={{ height: 32, fontSize: 12, color: 'rgba(35,31,26,0.45)' }}>{c.day}</span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
