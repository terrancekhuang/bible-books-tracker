import type { CSSProperties } from 'react'
import { useTheme } from '../lib/ThemeContext'

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
  const { isDark } = useTheme()
  return (
    <div
      className={`animate-pulse ${rounded} ${className}`}
      style={{ background: isDark ? 'rgba(150,175,255,0.1)' : 'rgba(13,21,51,0.07)', ...style }}
    />
  )
}
