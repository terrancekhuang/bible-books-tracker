import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { GILT } from '../lib/volumesTokens'

function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
}

export interface ActivityDay {
  logged_at: string
  chapters: number
}

/** A day's mark on the pricked calendar: an unfilled pinprick for nothing logged, or a gilt
 *  dot that grows and deepens with how much was read. `null` means the day doesn't get a mark
 *  at all (it's still in the future). */
interface DotVisual {
  filled: boolean
  opacity: number
  scale: number
}

const DOT_LEVELS: { opacity: number; scale: number }[] = [
  { opacity: 0.38, scale: 0.55 },
  { opacity: 0.6, scale: 0.72 },
  { opacity: 0.82, scale: 0.88 },
  { opacity: 1, scale: 1 },
]

function dotVisual(chapters: number, isFuture: boolean): DotVisual | null {
  if (isFuture) return null
  if (chapters === 0) return { filled: false, opacity: 1, scale: 0.55 }
  const level = chapters <= 2 ? 0 : chapters <= 5 ? 1 : chapters <= 10 ? 2 : 3
  return { filled: true, ...DOT_LEVELS[level] }
}

const LEGEND_DOTS: (DotVisual | null)[] = [
  { filled: false, opacity: 1, scale: 0.55 },
  ...DOT_LEVELS.map(level => ({ filled: true, ...level })),
]

function Dot({ visual, size }: { visual: DotVisual | null; size: number }) {
  if (!visual) return <div style={{ width: size, height: size }} />
  return (
    <div
      className="rounded-full"
      style={
        visual.filled
          ? { width: size * visual.scale, height: size * visual.scale, background: GILT, opacity: visual.opacity }
          : { width: size * visual.scale, height: size * visual.scale, border: '1px solid rgba(35,31,26,0.22)' }
      }
    />
  )
}

export default function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const labelColor = 'rgba(35,31,26,0.45)'

  const containerRef = useRef<HTMLDivElement>(null)
  const [tapped, setTapped] = useState<{
    wi: number
    di: number
    x: number
    top: number
    bottom: number
    placement: 'top' | 'bottom'
    text: string
  } | null>(null)

  useEffect(() => {
    if (!tapped) return
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTapped(null)
      }
    }
    function handleScroll() {
      setTapped(null)
    }
    document.addEventListener('click', handleOutsideClick)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [tapped])

  const weeks = useMemo(() => {
    const chaptersByDate = new Map<string, number>()
    for (const d of activity) {
      chaptersByDate.set(d.logged_at, (chaptersByDate.get(d.logged_at) ?? 0) + d.chapters)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() - 51 * 7)

    const result: Array<Array<{ dateStr: string; label: string; chapters: number; isFuture: boolean }>> = []
    const cursor = new Date(start)

    while (cursor <= new Date(today.getTime() + 7 * 86400000)) {
      if (result.length >= 53) break
      const week = []
      for (let d = 0; d < 7; d++) {
        const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        week.push({
          dateStr,
          label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          chapters: chaptersByDate.get(dateStr) ?? 0,
          isFuture: cursor > today,
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [activity])

  const monthLabels = useMemo(() => weeks.map(week => {
    const d = new Date(week[0].dateStr + 'T00:00:00')
    return d.getDate() <= 7 ? d.toLocaleString('en-US', { month: 'short' }) : ''
  }), [weeks])

  const labelStyle: CSSProperties = {
    fontSize: 10,
    color: labelColor,
    letterSpacing: '0.04em',
  }

  const cellSize = 11

  return (
    <div className="overflow-x-auto" ref={containerRef}>
      <div className="flex flex-col" style={{ gap: 2, minWidth: weeks.length * (cellSize + 2) + 22 }}>
        <div className="flex" style={{ gap: 2 }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, ${cellSize}px)`, gap: 2 }}>
            {monthLabels.map((label, i) => (
              <div key={i} style={{ ...labelStyle, overflow: 'visible', whiteSpace: 'nowrap' }}>{label}</div>
            ))}
          </div>
        </div>

        <div className="flex" style={{ gap: 2 }}>
          <div className="flex flex-col justify-around shrink-0" style={{ width: 16, marginRight: 4 }}>
            {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
              <div key={i} style={{ ...labelStyle, textAlign: 'right' }}>{d}</div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, ${cellSize}px)`, gap: 2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="flex items-center justify-center"
                    style={{ width: cellSize, height: cellSize }}
                    title={day.isFuture ? '' : `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`}
                    onClick={e => {
                      if (day.isFuture || !isTouchDevice()) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const placement = rect.top < 40 ? 'bottom' : 'top'
                      const text = `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`
                      setTapped(prev =>
                        prev?.wi === wi && prev?.di === di
                          ? null
                          : { wi, di, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, placement, text },
                      )
                    }}
                  >
                    <Dot visual={dotVisual(day.chapters, day.isFuture)} size={cellSize} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-1 self-end">
          <span style={labelStyle}>Less</span>
          {LEGEND_DOTS.map((v, i) => (
            <div key={i} className="flex items-center justify-center" style={{ width: 12, height: 12 }}>
              <Dot visual={v} size={12} />
            </div>
          ))}
          <span style={labelStyle}>More</span>
        </div>
      </div>

      {tapped &&
        createPortal(
          <div
            className="rounded shadow-lg"
            style={{
              position: 'fixed',
              left: tapped.x,
              ...(tapped.placement === 'top' ? { top: tapped.top - 6 } : { top: tapped.bottom + 6 }),
              transform: tapped.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              zIndex: 50,
              whiteSpace: 'nowrap',
              padding: '4px 8px',
              fontSize: 11,
              background: 'var(--color-leaf)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-leaf-rule)',
            }}
          >
            {tapped.text}
          </div>,
          document.body,
        )}
    </div>
  )
}
