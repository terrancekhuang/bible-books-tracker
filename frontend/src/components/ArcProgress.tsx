interface ArcProgressProps {
  total: number
  read: number
  size: number
  strokeWidth: number
  isDark: boolean
}

export default function ArcProgress({ total, read, size, strokeWidth, isDark }: ArcProgressProps) {
  const pct = total > 0 ? read / total : 0
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const isComplete = read >= total
  const isSmall = size < 52

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'}
          strokeWidth={strokeWidth}
        />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Raleway', sans-serif",
        color: isDark ? 'rgba(220,230,255,0.85)' : 'rgba(13,21,51,0.75)',
        textAlign: 'center', lineHeight: 1.1,
        pointerEvents: 'none',
      }}>
        {isComplete ? (
          <span style={{ fontSize: isSmall ? 13 : 22, fontWeight: 600 }}>✓</span>
        ) : pct === 0 ? (
          <span style={{ fontSize: isSmall ? 8 : 11, opacity: 0.4 }}>{total}</span>
        ) : (
          <>
            <span style={{ fontSize: isSmall ? 9 : 14, fontWeight: 700 }}>{read}</span>
            <span style={{ fontSize: isSmall ? 7 : 10, opacity: 0.5 }}>/{total}</span>
          </>
        )}
      </div>
    </div>
  )
}
