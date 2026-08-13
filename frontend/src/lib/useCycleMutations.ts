import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { createCreateCycleMutationOptions } from './cycleMutations'

/** Wires the cycle factory in cycleMutations.ts up to React context. */
export function useCreateCycle(): { create: () => Promise<boolean>; isCreating: boolean } {
  const queryClient = useQueryClient()
  const { logout } = useAuth()

  const { mutateAsync, isPending } = useMutation(
    createCreateCycleMutationOptions({ queryClient, logout }),
  )

  // Resolves to whether the caller should proceed to the new cycle. `false` covers both
  // a failed request and a 401 — the latter has already logged the user out, so there is
  // nowhere to navigate to either way.
  const create = useCallback(async (): Promise<boolean> => {
    try {
      return await mutateAsync() !== null
    } catch {
      return false
    }
  }, [mutateAsync])

  return { create, isCreating: isPending }
}
