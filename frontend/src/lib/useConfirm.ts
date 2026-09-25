import { useEffect, useState } from 'react'

/**
 * Two-step confirm for a set of actions, only one of which can be armed at a time: the first
 * press arms it, a second press of the same action commits it. Auto-cleared whenever
 * `resetKey` changes (e.g. switching to a different selected item).
 */
export function useConfirm<T extends string>(resetKey: unknown) {
  const [armed, setArmed] = useState<T | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setArmed(null), 0)
    return () => clearTimeout(t)
  }, [resetKey])

  return {
    armed,
    cancel: () => setArmed(null),
    /** Returns true and disarms if `action` is already armed (this is the commit press); otherwise arms it and returns false. */
    confirmOrArm: (action: T): boolean => {
      if (armed === action) {
        setArmed(null)
        return true
      }
      setArmed(action)
      return false
    },
  }
}
