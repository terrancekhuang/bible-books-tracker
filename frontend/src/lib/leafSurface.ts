import type { CSSProperties } from 'react'

/**
 * The paper/red-rule/shadow recipe shared by every "leaf" surface in the app — Tracker's
 * open-volume contents leaf, Dashboard's record leaf, and Profile's leaf. Padding and margin
 * are page-specific and stay with each caller; this covers only the material itself.
 */
export function leafSurfaceStyle(topBorderColor: string): CSSProperties {
  return {
    backgroundColor: 'var(--color-leaf)',
    backgroundImage: [
      'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px)',
      'linear-gradient(178deg, #F6F1E4, #F2ECDD 40%, #E6DECA)',
    ].join(', '),
    color: 'var(--color-ink)',
    boxShadow: '0 24px 44px -22px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(35,31,26,0.14)',
    borderTop: `6px solid ${topBorderColor}`,
    borderRadius: '0 0 0.5rem 0.5rem',
  }
}
