import type { ReactNode } from 'react'

const dimText = 'rgba(35,31,26,0.55)'
const primaryText = 'var(--color-ink)'

interface LeafMarginaliaItemProps {
  icon?: ReactNode
  label: ReactNode
  /** Rendered as the standard slab-numeral value. Ignored if `children` is passed. */
  value?: ReactNode
  /** Overrides the default value display — used for an in-place edit form (e.g. weekly goal). */
  children?: ReactNode
  /** The first item in the row skips its divider — the row's own dividers, not its edges. */
  first?: boolean
  /** Flex-grow, for a column that needs more room than its siblings (e.g. a wider goal editor). */
  flexGrow?: number
}

/**
 * One column of a leaf's marginalia row — an icon-labelled figure (or, via `children`, an
 * edit-in-place form) with a divider that's a horizontal rule when the row stacks on mobile and
 * a vertical rule alongside its siblings on desktop. Shared by Dashboard and Profile so the
 * responsive-divider behaviour is fixed in one place.
 */
export default function LeafMarginaliaItem({ icon, label, value, children, first = false, flexGrow = 1 }: LeafMarginaliaItemProps) {
  return (
    <div
      className={`flex flex-col items-center text-center py-3 md:py-0 ${!first ? 'border-t md:border-t-0 md:border-l' : ''}`}
      style={{ flex: flexGrow, borderColor: 'var(--color-leaf-rule)' }}
    >
      <span className="flex items-center gap-1.5" style={{ color: dimText }}>
        {icon}
        <span className="vol-num text-[10px] uppercase" style={{ letterSpacing: '0.2em' }}>{label}</span>
      </span>
      {children ?? (
        <span className="slab text-2xl mt-1" style={{ color: primaryText }}>{value}</span>
      )}
    </div>
  )
}
