import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'

/** How long a trigger must be hovered before its tooltip appears, the first time. */
export const TOOLTIP_OPEN_DELAY = 550

/** Once a tooltip has actually shown and then closed, another trigger hovered within this
 *  window skips the open delay — lets you sweep across adjacent tooltips without a pause
 *  between each one. Only a tooltip that actually appeared starts this window: passing over
 *  a trigger too briefly for it to show doesn't unlock the fast path for the next one. */
export const TOOLTIP_SKIP_WINDOW = 400

interface TooltipGroupValue {
  isWithinSkipWindow: () => boolean
  markShown: () => void
  markHidden: () => void
}

const TooltipGroupContext = createContext<TooltipGroupValue | null>(null)

export function TooltipGroupProvider({ children }: { children: ReactNode }) {
  const lastHiddenAt = useRef<number | null>(null)

  const isWithinSkipWindow = useCallback(
    () => lastHiddenAt.current !== null && Date.now() - lastHiddenAt.current < TOOLTIP_SKIP_WINDOW,
    [],
  )
  const markShown = useCallback(() => { lastHiddenAt.current = null }, [])
  const markHidden = useCallback(() => { lastHiddenAt.current = Date.now() }, [])

  const value = useMemo(
    () => ({ isWithinSkipWindow, markShown, markHidden }),
    [isWithinSkipWindow, markShown, markHidden],
  )

  return <TooltipGroupContext.Provider value={value}>{children}</TooltipGroupContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTooltipGroup(): TooltipGroupValue {
  const ctx = useContext(TooltipGroupContext)
  if (!ctx) throw new Error('useTooltipGroup must be used inside TooltipGroupProvider')
  return ctx
}
