export default function CircularProgress({ value, max, size = 128 }: { value: number; max: number; size?: number }) {
  const strokeWidth = 10
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const dashOffset = circumference * (1 - pct)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        className="text-slate-100 dark:text-slate-700"
      />
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
    </svg>
  )
}
