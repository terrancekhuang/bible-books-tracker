import type { ReactNode } from 'react'

interface DashboardEntryRowProps {
  /** Primary label — a book name, "Old Testament", or a category. */
  label: string
  /** Optional leading glyph, e.g. a CategoryIcon for category rows. */
  icon?: ReactNode
  /** Trailing figure after the leader-dot line, e.g. "3 / 28" or "412 / 592 · 70%". */
  trailing: string
  /** Progress fraction 0-1 for the rule underneath. */
  progress: number
  /** The rule's fill colour — a volume's cloth colour, or a fixed accent for non-category rows. */
  ruleColor: string
  onClick?: () => void
}

/**
 * One ruled entry in the Dashboard's record leaf — the same leader-dot row and cloth-tinted
 * progress rule Tracker's ContentsLeaf uses for its book list, generalised for Continue Reading,
 * Testament Progress and Category Progress so all three share one row instead of three layouts.
 */
export default function DashboardEntryRow({ label, icon, trailing, progress, ruleColor, onClick }: DashboardEntryRowProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'transparent', border: 'none', font: 'inherit',
        padding: '9px 2px 7px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {icon && <span style={{ flexShrink: 0, color: 'rgba(35,31,26,0.55)' }}>{icon}</span>}
        <span className="vol-num" style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-ink)' }}>
          {label}
        </span>
        <span
          aria-hidden
          style={{
            flex: 1, height: '1em', minWidth: 24,
            backgroundImage: 'radial-gradient(circle at 50% 90%, rgba(35,31,26,0.42) 0 1px, transparent 1.2px)',
            backgroundSize: '6px 100%',
          }}
        />
        <span className="vol-num" style={{ fontSize: 13, color: 'rgba(35,31,26,0.78)', whiteSpace: 'nowrap' }}>
          {trailing}
        </span>
      </span>
      <span aria-hidden style={{ display: 'block', height: 3, marginTop: 6, background: 'rgba(35,31,26,0.13)' }}>
        <span
          style={{
            display: 'block', height: '100%', width: '100%',
            transform: `scaleX(${Math.min(Math.max(progress, 0), 1)})`, transformOrigin: 'left',
            background: ruleColor,
            transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </span>
    </Tag>
  )
}
