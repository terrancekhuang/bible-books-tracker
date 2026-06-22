import { SegmentedProgressBar } from 'bible-books-tracker'

const row = (label: string, total: number, read: number[]) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ color: 'rgba(195,210,255,0.6)', fontSize: 10, fontFamily: 'Raleway,sans-serif', letterSpacing: '0.05em', marginBottom: 5 }}>
      {label}
    </div>
    <SegmentedProgressBar total={total} readChapters={read} />
  </div>
)

export function Dark() {
  return (
    <div style={{ padding: '20px 24px', background: '#0d1533', borderRadius: 10, width: 340 }}>
      {row('Genesis — 0 / 50 read', 50, [])}
      {row('Psalms — 73 / 150 read', 150, Array.from({ length: 73 }, (_, i) => i + 1))}
      {row('John — 21 / 21 complete', 21, Array.from({ length: 21 }, (_, i) => i + 1))}
      {row('Romans — scattered', 16, [1, 2, 4, 5, 8, 12, 16])}
    </div>
  )
}
