import { useCallback, useRef } from 'react'

/**
 * Tracks a leader-key chord (e.g. "g" then "d") with a timeout window.
 * `arm()` marks the leader as pressed; `consume()` returns whether the
 * leader is still armed and clears it either way.
 */
export function useKeyChord(timeoutMs = 500) {
  const armedRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)

  const arm = useCallback(() => {
    armedRef.current = true
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => { armedRef.current = false }, timeoutMs)
  }, [timeoutMs])

  const consume = useCallback((): boolean => {
    const wasArmed = armedRef.current
    if (wasArmed) {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      armedRef.current = false
    }
    return wasArmed
  }, [])

  return { arm, consume }
}
