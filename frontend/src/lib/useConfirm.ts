import { useEffect, useState } from 'react'

/**
 * Two-step "confirm" toggle (e.g. "Reset" -> "Confirm reset?"), auto-cleared
 * whenever `resetKey` changes (e.g. switching to a different selected item).
 */
export function useConfirm(resetKey: unknown) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setConfirming(false), 0)
    return () => clearTimeout(t)
  }, [resetKey])

  return {
    confirming,
    request: () => setConfirming(true),
    cancel: () => setConfirming(false),
    /** Returns true and clears state if already confirming (i.e. this is the "commit" press); otherwise arms it and returns false. */
    confirmOrRequest: (): boolean => {
      if (confirming) {
        setConfirming(false)
        return true
      }
      setConfirming(true)
      return false
    },
  }
}
