import type { CSSProperties } from 'react'

export default function Skeleton({
  className = '',
  style,
  rounded = 'rounded-lg',
}: {
  className?: string
  style?: CSSProperties
  /** Tailwind rounding class; pass e.g. "rounded-full" for circular placeholders. */
  rounded?: string
}) {
  return (
    <div
      className={`animate-pulse ${rounded} ${className}`}
      style={{ background: 'rgba(35,31,26,0.07)', ...style }}
    />
  )
}
