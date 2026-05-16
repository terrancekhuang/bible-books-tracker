import { useEffect, useState } from 'react'

export default function CircularProgress({ value, max, size = 128, pulseKey = 0 }: { value: number; max: number; size?: number; pulseKey?: number }) {
  const strokeWidth = 10
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const dashOffset = circumference * (1 - pct)

  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    if (pulseKey === 0) return
    setIsPulsing(true)
    const t = setTimeout(() => setIsPulsing(false), 900)
    return () => clearTimeout(t)
  }, [pulseKey])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        className="text-slate-100 dark:text-slate-700"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        stroke="currentColor"
        className="text-indigo-500 transition-all duration-700 ease-out"
      />
      {/* Ripple on update */}
      {isPulsing && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          stroke="currentColor"
          className="text-indigo-400"
          style={{
            animation: 'ring-ripple 700ms ease-out forwards',
            transformBox: 'fill-box' as never,
            transformOrigin: 'center',
          }}
        />
      )}
    </svg>
  )
}
