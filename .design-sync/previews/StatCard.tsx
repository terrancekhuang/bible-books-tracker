import { StatCard, FlameIcon, CalendarIcon, BookOpenIcon, TargetIcon } from 'bible-books-tracker'

export function Default() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: 24, background: '#0d1533', borderRadius: 10, maxWidth: 480 }}>
      <StatCard label="Current Streak" value="12 days" icon={<FlameIcon size={20} />} />
      <StatCard label="Chapters Today" value="7" icon={<CalendarIcon size={20} />} />
      <StatCard label="Total Chapters" value="799" icon={<BookOpenIcon size={20} />} />
      <StatCard label="Books Complete" value="23 / 66" icon={<TargetIcon size={20} />} />
    </div>
  )
}

export function WithoutIcon() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: 24, background: '#0d1533', borderRadius: 10, maxWidth: 480 }}>
      <StatCard label="Reading Days" value="94" />
      <StatCard label="This Week" value="34 ch" />
    </div>
  )
}
