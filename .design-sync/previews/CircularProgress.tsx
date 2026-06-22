import { CircularProgress } from 'bible-books-tracker'

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 28, background: '#0d1533', borderRadius: 10, alignItems: 'center', flexWrap: 'wrap', color: 'rgba(150,175,255,0.8)' }}>
      <CircularProgress value={0} max={66} size={96} trackClassName="text-slate-700" arcClassName="text-[rgba(150,175,255,0.8)]" />
      <CircularProgress value={29} max={66} size={96} trackClassName="text-slate-700" arcClassName="text-[rgba(150,175,255,0.8)]" />
      <CircularProgress value={66} max={66} size={96} trackClassName="text-slate-700" arcClassName="text-[rgba(150,175,255,0.8)]" />
      <CircularProgress value={18} max={30} size={128} trackClassName="text-slate-700" arcClassName="text-[rgba(130,170,255,0.9)]" />
    </div>
  )
}
