import { HomeIcon } from 'bible-books-tracker'

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 28, background: '#0d1533', borderRadius: 10, alignItems: 'center', color: 'rgba(195,210,255,0.85)' }}>
      <HomeIcon size={48} />
      <HomeIcon size={32} />
      <HomeIcon size={20} />
    </div>
  )
}
