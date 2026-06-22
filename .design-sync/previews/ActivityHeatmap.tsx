import { ActivityHeatmap } from 'bible-books-tracker'

function makeActivity() {
  const days = []
  const today = new Date()
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const isWeekday = d.getDay() > 0 && d.getDay() < 6
    const rand = Math.random()
    if (rand < (isWeekday ? 0.65 : 0.4)) {
      days.push({ logged_at: dateStr, chapters: Math.ceil(Math.random() * 12) })
    }
  }
  return days
}

const activity = makeActivity()

export function Default() {
  return (
    <div style={{ padding: 24, background: '#0d1533', borderRadius: 10, overflowX: 'auto' }}>
      <ActivityHeatmap activity={activity} />
    </div>
  )
}
