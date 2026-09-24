import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { GILT } from '../lib/volumesTokens'
import { TOOLTIP_OPEN_DELAY, useTooltipGroup } from '../lib/TooltipGroupContext'

function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
}

export interface ActivityDay {
  logged_at: string
  chapters: number
}

/** Gilt shades for 1–2, 3–5, 6–10 and 11+ chapters. */
const LEVEL_OPACITY = [0.3, 0.5, 0.75, 1]

function levelOf(chapters: number) {
  return chapters <= 2 ? 0 : chapters <= 5 ? 1 : chapters <= 10 ? 2 : 3
}

/** A day's square: faint when nothing was read (or the day is still to come), gilt deepening
 *  with how much was. Fills its cell, so the grid's cells can stretch to fit the leaf. */
function Square({ level }: { level: number | null }) {
  return (
    <div
      className="w-full h-full"
      style={{
        borderRadius: 2,
        background: level === null ? 'rgba(35,31,26,0.07)' : GILT,
        opacity: level === null ? 1 : LEVEL_OPACITY[level],
      }}
    />
  )
}

interface CellTooltip {
  wi: number
  di: number
  x: number
  top: number
  bottom: number
  placement: 'top' | 'bottom'
  text: string
}

export default function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const labelColor = 'rgba(35,31,26,0.45)'

  const containerRef = useRef<HTMLDivElement>(null)
  const [tapped, setTapped] = useState<CellTooltip | null>(null)

  // Desktop hover mirrors the tap tooltip above but follows the shared open-delay/skip-window
  // timing (TooltipGroupContext) — the first cell hovered waits out the delay, sweeping on to
  // adjacent cells afterward shows instantly.
  const [hovered, setHovered] = useState<CellTooltip | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const hoverShownRef = useRef(false)
  const tooltipGroup = useTooltipGroup()

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const handleCellEnter = (next: CellTooltip) => {
    clearHoverTimer()
    if (tooltipGroup.isWithinSkipWindow()) {
      hoverShownRef.current = true
      tooltipGroup.markShown()
      setHovered(next)
    } else {
      hoverTimerRef.current = window.setTimeout(() => {
        hoverShownRef.current = true
        tooltipGroup.markShown()
        setHovered(next)
      }, TOOLTIP_OPEN_DELAY)
    }
  }

  const handleCellLeave = () => {
    clearHoverTimer()
    if (hoverShownRef.current) {
      hoverShownRef.current = false
      tooltipGroup.markHidden()
    }
    setHovered(null)
  }

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

  // Only years with something logged are offered; the newest is shown first. With no activity
  // at all there's still the current year, drawn empty.
  const years = useMemo(() => {
    const found = [...new Set(activity.map(d => Number(d.logged_at.slice(0, 4))))].sort((a, b) => b - a)
    return found.length ? found : [new Date().getFullYear()]
  }, [activity])
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const year = pickedYear !== null && years.includes(pickedYear) ? pickedYear : years[0]

  // The calendar year, Sunday-first weeks: from the week holding Jan 1 to the week holding Dec 31.
  // Days outside the year get no square; days still to come get an empty one.
  const { weeks, monthLabels } = useMemo(() => {
    const chaptersByDate = new Map<string, number>()
    for (const d of activity) {
      chaptersByDate.set(d.logged_at, (chaptersByDate.get(d.logged_at) ?? 0) + d.chapters)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cursor = new Date(year, 0, 1)
    cursor.setDate(1 - cursor.getDay())
    const end = new Date(year, 11, 31)

    const weeks: Array<Array<{ label: string; chapters: number; inYear: boolean; future: boolean }>> = []
    const monthLabels: string[] = []
    while (cursor <= end) {
      const week = []
      let month = ''
      for (let d = 0; d < 7; d++) {
        const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        const inYear = cursor.getFullYear() === year
        week.push({
          label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          chapters: chaptersByDate.get(dateStr) ?? 0,
          inYear,
          future: cursor > today,
        })
        if (inYear && cursor.getDate() === 1) month = cursor.toLocaleString('en-US', { month: 'short' })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
      monthLabels.push(month)
    }
    return { weeks, monthLabels }
  }, [activity, year])

  const labelStyle: CSSProperties = {
    fontSize: 10,
    color: labelColor,
    letterSpacing: '0.04em',
  }

  // Columns stretch to fill the leaf, so a whole year fits on desktop; below the minimum
  // cell size (phones) the grid scrolls instead.
  const minCell = 9
  const columns = `repeat(${weeks.length}, minmax(${minCell}px, 1fr))`

  return (
    <div className="overflow-x-auto" ref={containerRef}>
      <div className="flex flex-col" style={{ gap: 2, minWidth: weeks.length * (minCell + 2) + 22 }}>
        <div className="flex" style={{ gap: 2 }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div className="grid flex-1" style={{ gridTemplateColumns: columns, gap: 2 }}>
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
          <div className="grid flex-1" style={{ gridTemplateColumns: columns, gap: 2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
                {week.map((day, di) => {
                  const quiet = !day.inYear || day.future
                  return (
                    <div
                      key={di}
                      style={{ aspectRatio: '1' }}
                      aria-label={quiet ? undefined : `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`}
                      onClick={e => {
                        if (quiet || !isTouchDevice()) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const placement = rect.top < 40 ? 'bottom' : 'top'
                        const text = `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`
                        setTapped(prev =>
                          prev?.wi === wi && prev?.di === di
                            ? null
                            : { wi, di, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, placement, text },
                        )
                      }}
                      onMouseEnter={e => {
                        if (quiet || isTouchDevice()) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const placement = rect.top < 40 ? 'bottom' : 'top'
                        const text = `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`
                        handleCellEnter({ wi, di, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, placement, text })
                      }}
                      onMouseLeave={handleCellLeave}
                    >
                      {day.inYear && <Square level={day.chapters && !day.future ? levelOf(day.chapters) : null} />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <select
            value={year}
            onChange={e => { setPickedYear(Number(e.target.value)); setTapped(null) }}
            aria-label="Year"
            className="vol-num rounded mr-auto"
            style={{
              ...labelStyle,
              color: 'var(--color-ink)',
              background: 'transparent',
              border: '1px solid rgba(35,31,26,0.2)',
              padding: '2px 4px',
            }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={labelStyle}>Less</span>
          {[null, 0, 1, 2, 3].map(level => (
            <div key={level ?? 'none'} style={{ width: 11, height: 11 }}>
              <Square level={level} />
            </div>
          ))}
          <span style={labelStyle}>More</span>
        </div>
      </div>

      {(tapped ?? hovered) &&
        createPortal(
          (() => {
            const active = (tapped ?? hovered)!
            return (
              <div
                className="rounded shadow-lg"
                style={{
                  position: 'fixed',
                  left: active.x,
                  ...(active.placement === 'top' ? { top: active.top - 6 } : { top: active.bottom + 6 }),
                  transform: active.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                  zIndex: 50,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'var(--color-leaf)',
                  color: 'var(--color-ink)',
                  border: '1px solid var(--color-leaf-rule)',
                }}
              >
                {active.text}
              </div>
            )
          })(),
          document.body,
        )}
    </div>
  )
}
