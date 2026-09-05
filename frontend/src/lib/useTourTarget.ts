import { useEffect, useState } from 'react'

/** How long to keep watching for a step's target to appear/settle after navigating. */
const RESOLVE_WINDOW_MS = 3000
/** Re-scrolling only within this window keeps a later scroll/resize remeasure from
 *  fighting the user's own scrolling once the page has settled. */
const AUTO_SCROLL_WINDOW_MS = 1500
/** Ignore position drift smaller than this — avoids re-triggering scroll for sub-pixel jitter. */
const SCROLL_DRIFT_THRESHOLD_PX = 24

interface TargetState {
  selector: string | null
  rect: DOMRect | null
}

/**
 * Resolves a CSS selector to its element's live bounding rect, tolerant of the element
 * not existing yet (e.g. right after navigating to a new route) or of its position
 * settling late (e.g. a section above it that only renders once its data has loaded).
 */
export function useTourTarget(selector: string | null): DOMRect | null {
  const [state, setState] = useState<TargetState>({ selector, rect: null })

  // Reset the moment the selector changes, before the effect below resolves the new one —
  // adjusting state during render (matching it against a prop) rather than from inside an
  // effect, per https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  if (state.selector !== selector) {
    setState({ selector, rect: null })
  }

  useEffect(() => {
    if (!selector) return

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let mutationObserver: MutationObserver | null = null
    let timeoutId: number | null = null
    let lastScrolledTop: number | null = null
    const scrollWindowEnd = Date.now() + AUTO_SCROLL_WINDOW_MS

    const applyRect = (el: Element) => {
      if (cancelled) return
      setState({ selector, rect: el.getBoundingClientRect() })
    }

    const observeElement = (el: Element) => {
      resizeObserver?.disconnect()
      resizeObserver = new ResizeObserver(() => applyRect(el))
      resizeObserver.observe(el)
    }

    // Scrolls the target into view, then nudges it back into view if later-arriving content
    // (e.g. a section above it that only renders once its own data has loaded) shifts its
    // position — but only within a short window after the step starts, so it never fights
    // the user's own scrolling once the page has settled.
    const maybeScrollIntoView = (el: Element, rect: DOMRect) => {
      if (Date.now() > scrollWindowEnd) return
      if (lastScrolledTop !== null && Math.abs(rect.top - lastScrolledTop) < SCROLL_DRIFT_THRESHOLD_PX) return
      lastScrolledTop = rect.top
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    const tryResolve = (scroll: boolean): boolean => {
      if (cancelled) return false
      const el = document.querySelector(selector)
      if (!el) return false
      const rect = el.getBoundingClientRect()
      if (scroll) maybeScrollIntoView(el, rect)
      applyRect(el)
      observeElement(el)
      return true
    }

    // Deferred so the first lookup runs from a microtask callback rather than
    // synchronously inside the effect body.
    queueMicrotask(() => tryResolve(true))

    // Kept alive for the whole resolve window (not just until first found) — this is what
    // catches the target settling into its final position after sibling content mounts late.
    mutationObserver = new MutationObserver(() => tryResolve(true))
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    // Safety valve: a bad selector or gated content shouldn't leave the tour watching forever.
    timeoutId = window.setTimeout(() => mutationObserver?.disconnect(), RESOLVE_WINDOW_MS)

    const onScrollOrResize = () => tryResolve(false)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)

    return () => {
      cancelled = true
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [selector])

  return state.selector === selector ? state.rect : null
}
