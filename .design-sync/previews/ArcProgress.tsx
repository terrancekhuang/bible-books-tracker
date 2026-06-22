import { ArcProgress } from 'bible-books-tracker'

const wrap = (children: React.ReactNode, bg = '#0d1533') => (
  <div style={{ display: 'flex', gap: 24, padding: 28, background: bg, borderRadius: 10, alignItems: 'center', flexWrap: 'wrap' }}>
    {children}
  </div>
)

const label = (text: string) => (
  <div style={{ textAlign: 'center', color: 'rgba(195,210,255,0.6)', fontSize: 10, fontFamily: 'Raleway,sans-serif', letterSpacing: '0.06em', marginTop: 6 }}>{text}</div>
)

export function Dark() {
  return wrap(
    <>
      <div style={{ textAlign: 'center' }}>
        <ArcProgress total={28} read={0} size={72} strokeWidth={6} isDark={true} />
        {label('0 / 28')}
      </div>
      <div style={{ textAlign: 'center' }}>
        <ArcProgress total={50} read={18} size={72} strokeWidth={6} isDark={true} />
        {label('18 / 50')}
      </div>
      <div style={{ textAlign: 'center' }}>
        <ArcProgress total={29} read={29} size={72} strokeWidth={6} isDark={true} />
        {label('29 / 29')}
      </div>
      <div style={{ textAlign: 'center' }}>
        <ArcProgress total={66} read={41} size={112} strokeWidth={9} isDark={true} />
        {label('All books')}
      </div>
    </>,
  )
}

export function Light() {
  return wrap(
    <>
      <ArcProgress total={28} read={9} size={72} strokeWidth={6} isDark={false} />
      <ArcProgress total={50} read={33} size={72} strokeWidth={6} isDark={false} />
      <ArcProgress total={29} read={29} size={72} strokeWidth={6} isDark={false} />
    </>,
    '#eef0f6',
  )
}
