export interface ActivityDay {
  logged_at: string
  chapters: number
}

function intensityClass(chapters: number): string {
  if (chapters === 0) return 'bg-slate-100 dark:bg-slate-800'
  if (chapters <= 2) return 'bg-indigo-200 dark:bg-indigo-900'
  if (chapters <= 5) return 'bg-indigo-400 dark:bg-indigo-700'
  if (chapters <= 10) return 'bg-indigo-600 dark:bg-indigo-500'
  return 'bg-indigo-800 dark:bg-indigo-300'
}

export default function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const chaptersByDate = new Map<string, number>()
  for (const d of activity) {
    const dt = new Date(d.logged_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
    chaptersByDate.set(key, (chaptersByDate.get(key) ?? 0) + d.chapters)
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

  return (
    <div className="w-full flex flex-col" style={{ gap: 2 }}>
      <div className="flex" style={{ gap: 2 }}>
        <div style={{ width: 20, flexShrink: 0 }} />
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 2 }}
        >
          {monthLabels.map((label, i) => (
            <div key={i} className="text-xs text-slate-400 dark:text-slate-500 overflow-visible whitespace-nowrap">
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex" style={{ gap: 2 }}>
        <div className="flex flex-col justify-around shrink-0" style={{ width: 16, marginRight: 4 }}>
          {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
            <div key={i} className="text-xs text-slate-400 dark:text-slate-500 text-right">{d}</div>
          ))}
        </div>
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 2 }}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-full aspect-square rounded-sm ${
                    day.isFuture ? '' : intensityClass(day.chapters)
                  }`}
                  title={day.isFuture ? '' : `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-1 self-end">
        <span className="text-xs text-slate-400 dark:text-slate-500">Less</span>
        {['bg-slate-100 dark:bg-slate-800', 'bg-indigo-200 dark:bg-indigo-900', 'bg-indigo-400 dark:bg-indigo-700', 'bg-indigo-600 dark:bg-indigo-500', 'bg-indigo-800 dark:bg-indigo-300'].map((cls, i) => (
          <div key={i} className={`rounded-sm ${cls}`} style={{ width: 12, height: 12 }} />
        ))}
        <span className="text-xs text-slate-400 dark:text-slate-500">More</span>
      </div>
    </div>
  )
}
