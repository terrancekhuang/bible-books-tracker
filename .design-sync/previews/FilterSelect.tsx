import { FilterSelect } from 'bible-books-tracker'

const CATEGORIES = ['Pentateuch', 'History', 'Poetry', 'Prophecy', 'Gospels', 'Epistles']
const TESTAMENTS = ['OT', 'NT']
const label = (t: string) => (
  <span style={{ color: 'rgba(195,210,255,0.45)', fontSize: 10, fontFamily: 'Raleway,sans-serif', letterSpacing: '0.05em', alignSelf: 'center' }}>{t}</span>
)

export function Default() {
  return (
    <div style={{ padding: 24, background: '#0d1533', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {label('inactive')}
        <FilterSelect value="" onChange={() => {}} placeholder="All books" options={CATEGORIES} />
        <FilterSelect value="" onChange={() => {}} placeholder="Testament" options={TESTAMENTS} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {label('active')}
        <FilterSelect value="Gospels" onChange={() => {}} placeholder="Category" options={CATEGORIES} />
        <FilterSelect value="NT" onChange={() => {}} placeholder="Testament" options={TESTAMENTS} />
      </div>
    </div>
  )
}
