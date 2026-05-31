import type { CSSProperties } from 'react'

export interface ActivityDay {
  logged_at: string
  chapters: number
}

function intensityStyle(chapters: number, isFuture: boolean): CSSProperties {
  if (isFuture) return {}
  if (chapters === 0) return { background: 'rgba(150,175,255,0.07)' }
  if (chapters <= 2) return { background: 'rgba(120,155,255,0.28)' }
  if (chapters <= 5) return { background: 'rgba(130,170,255,0.52)' }
  if (chapters <= 10) return { background: 'rgba(160,195,255,0.72)' }
  return { background: 'rgba(210,185,100,0.8)' }
}

const LEGEND_STYLES: CSSProperties[] = [
  { background: 'rgba(150,175,255,0.07)' },
  { background: 'rgba(120,155,255,0.28)' },
  { background: 'rgba(130,170,255,0.52)' },
  { background: 'rgba(160,195,255,0.72)' },
  { background: 'rgba(210,185,100,0.8)' },
]

export default function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const chaptersByDate = new Map<string, number>()
  for (const d of activity) {
    chaptersByDate.set(d.logged_at, (chaptersByDate.get(d.logged_at) ?? 0) + d.chapters)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - 51 * 7)

  const weeks: Array<Array<{ dateStr: string; label: string; chapters: number; isFuture: boolean }>> = []
  const cursor = new Date(start)

  while (cursor <= new Date(today.getTime() + 7 * 86400000)) {
    if (weeks.length >= 53) break
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
    weeks.push(week)
  }

  const monthLabels = weeks.map(week => {
    const d = new Date(week[0].dateStr + 'T00:00:00')
    return d.getDate() <= 7 ? d.toLocaleString('en-US', { month: 'short' }) : ''
  })

  const labelStyle: CSSProperties = {
    fontSize: 10,
    fontFamily: "'Raleway', sans-serif",
    color: 'rgba(150,175,255,0.4)',
    letterSpacing: '0.04em',
  }

  const cellSize = 11

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
                    style={{ width: cellSize, height: cellSize, ...intensityStyle(day.chapters, day.isFuture) }}
                    title={day.isFuture ? '' : `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 mt-1 self-end">
          <span style={labelStyle}>Less</span>
          {LEGEND_STYLES.map((s, i) => (
            <div key={i} className="rounded-sm" style={{ width: 12, height: 12, ...s }} />
          ))}
          <span style={labelStyle}>More</span>
        </div>
      </div>
    </div>
  )
}
