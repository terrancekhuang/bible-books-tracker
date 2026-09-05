import type { ReactNode } from 'react'

const dimText = 'rgba(35,31,26,0.55)'

/** The small-caps caption above a leaf subsection — Reading Activity, Achievements, and so on. */
export default function LeafSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="vol-num" style={{ margin: '0 0 14px', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: dimText }}>
      {children}
    </p>
  )
}
