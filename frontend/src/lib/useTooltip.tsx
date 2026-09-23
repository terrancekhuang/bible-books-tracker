import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TOOLTIP_OPEN_DELAY, useTooltipGroup } from './TooltipGroupContext'

interface UseTooltipResult {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void
  onMouseLeave: () => void
  /** Render this wherever's convenient — it's a portal, so placement in the tree doesn't matter. */
  tooltip: React.ReactNode
}

/** Spread the returned handlers onto a trigger element as literal `onMouseEnter`/`onMouseLeave`
 *  JSX attributes (a hook can't hand them to `cloneElement` or a render-prop call itself —
 *  only a real host-element JSX attribute is a safe place to read the refs this closes over).
 *  Shares the app-wide group timing: the first tooltip in a hover session waits out
 *  `TOOLTIP_OPEN_DELAY`, but sweeping on to another trigger shortly after closing one shows
 *  the next instantly. See TooltipGroupContext. */
export function useTooltip(label: React.ReactNode, placement: 'top' | 'bottom' = 'top'): UseTooltipResult {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const shownRef = useRef(false)
  const group = useTooltipGroup()

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const show = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    setPos(
      placement === 'top'
        ? { x: rect.left + rect.width / 2, y: rect.top - 8 }
        : { x: rect.left + rect.width / 2, y: rect.bottom + 8 },
    )
    shownRef.current = true
    group.markShown()
  }

  const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (!label) return
    if (!window.matchMedia('(hover: hover)').matches) return
    clearTimer()
    const target = e.currentTarget
    if (group.isWithinSkipWindow()) show(target)
    else timerRef.current = window.setTimeout(() => show(target), TOOLTIP_OPEN_DELAY)
  }

  const onMouseLeave = () => {
    clearTimer()
    if (shownRef.current) {
      shownRef.current = false
      setPos(null)
      group.markHidden()
    }
  }

  const tooltip = pos && createPortal(
    <div
      role="tooltip"
      className="fixed text-xs px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-50"
      style={{
        left: pos.x, top: pos.y,
        transform: placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        background: 'var(--color-shelf)',
        border: '1px solid var(--color-shelf-lit)',
        color: 'var(--color-leaf)',
      }}
    >
      {label}
    </div>,
    document.body,
  )

  return { onMouseEnter, onMouseLeave, tooltip }
}
