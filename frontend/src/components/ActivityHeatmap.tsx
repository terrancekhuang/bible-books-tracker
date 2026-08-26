import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { useTheme } from '../lib/ThemeContext'

export interface ActivityDay {
  logged_at: string
  chapters: number
}

const LEGEND_STYLES_DARK: CSSProperties[] = [
  { background: 'rgba(150,175,255,0.07)' },
  { background: 'rgba(120,155,255,0.28)' },
  { background: 'rgba(130,170,255,0.52)' },
  { background: 'rgba(145,180,255,0.78)' },
  { background: 'rgba(130,160,255,1.0)' },
]

const LEGEND_STYLES_LIGHT: CSSProperties[] = [
  { background: 'rgba(100,130,255,0.08)' },
  { background: 'rgba(80,110,220,0.25)' },
  { background: 'rgba(70,100,210,0.50)' },
  { background: 'rgba(60,90,220,0.72)' },
  { background: 'rgba(60,90,220,0.9)' },
]

function intensityStyle(chapters: number, isFuture: boolean, styles: CSSProperties[]): CSSProperties {
  if (isFuture) return {}
  if (chapters === 0) return styles[0]
  if (chapters <= 2) return styles[1]
  if (chapters <= 5) return styles[2]
  if (chapters <= 10) return styles[3]
  return styles[4]
}

interface TappedTooltip {
  key: string
  text: string
  x: number
  y: number
}

export default function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const { isDark } = useTheme()
  const legendStyles = isDark ? LEGEND_STYLES_DARK : LEGEND_STYLES_LIGHT
  const labelColor = isDark ? 'rgba(150,175,255,0.4)' : 'rgba(60,90,180,0.45)'
  const [tapped, setTapped] = useState<TappedTooltip | null>(null)

  useEffect(() => {
    if (!tapped) return
    const close = () => setTapped(null)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
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

  function handleCellTap(e: MouseEvent<HTMLDivElement>, day: { dateStr: string; label: string; chapters: number; isFuture: boolean }) {
    if (day.isFuture) return
    e.stopPropagation()
    setTapped(prev => {
      if (prev?.key === day.dateStr) return null
      const rect = e.currentTarget.getBoundingClientRect()
      return {
        key: day.dateStr,
        text: `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`,
        x: rect.left + rect.width / 2,
        y: rect.top,
      }
    })
  }

  return (
    <div className="overflow-x-auto">
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
                    className="rounded-sm"
                    style={{ width: cellSize, height: cellSize, ...intensityStyle(day.chapters, day.isFuture, legendStyles) }}
                    title={day.isFuture ? '' : `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`}
                    onClick={e => handleCellTap(e, day)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 mt-1 self-end">
          <span style={labelStyle}>Less</span>
          {legendStyles.map((s, i) => (
            <div key={i} className="rounded-sm" style={{ width: 12, height: 12, ...s }} />
          ))}
          <span style={labelStyle}>More</span>
        </div>
      </div>

      {tapped && (
        <div
          className="rounded-md shadow-lg"
          style={{
            position: 'fixed',
            left: tapped.x,
            top: tapped.y - 8,
            transform: 'translate(-50%, -100%)',
            padding: '4px 8px',
            fontSize: 11,
            whiteSpace: 'nowrap',
            background: isDark ? 'rgba(30,35,55,0.95)' : 'rgba(255,255,255,0.97)',
            color: isDark ? 'rgba(230,235,255,0.95)' : 'rgba(30,40,70,0.95)',
            border: isDark ? '1px solid rgba(150,175,255,0.25)' : '1px solid rgba(60,90,220,0.2)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          {tapped.text}
        </div>
      )}
    </div>
  )
}
