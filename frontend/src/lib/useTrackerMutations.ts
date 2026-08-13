import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { useSyncContext } from './SyncContext'
import { createSubmitMutationOptions, createUndoMutationOptions, createResetMutationOptions } from './trackerMutations'
import type { MutationDeps } from './trackerMutations'
import type { Book } from './trackerLogic'

export interface TrackerMutations {
  isOnline: boolean
  pendingCount: number
  submit: (book: Book, chapters: number[]) => Promise<void>
  undo: (book: Book) => Promise<void>
  reset: (book: Book) => Promise<void>
}

/** Wires the mutation factories in trackerMutations.ts up to React context. */
export function useTrackerMutations(): TrackerMutations {
  const queryClient = useQueryClient()
  const { logout } = useAuth()
  const { isOnline, pendingCount, enqueue } = useSyncContext()

  const deps: MutationDeps = useMemo(
    () => ({ queryClient, logout, enqueue }),
    [queryClient, logout, enqueue],
  )

  const { mutateAsync: submitAsync } = useMutation(createSubmitMutationOptions(deps))
  const { mutateAsync: undoAsync } = useMutation(createUndoMutationOptions(deps))
  const { mutateAsync: resetAsync } = useMutation(createResetMutationOptions(deps))

  // mutateAsync rejects on a genuine server error so onError can roll back, but
  // callers here have nothing to do with the rejection — onError already handled it.
  const submit = useCallback(async (book: Book, chapters: number[]) => {
    if (chapters.length === 0) return
    await submitAsync({ book, chapters }).catch(() => {})
  }, [submitAsync])

  const undo = useCallback(async (book: Book) => {
    await undoAsync({ book }).catch(() => {})
  }, [undoAsync])

  const reset = useCallback(async (book: Book) => {
    await resetAsync({ book }).catch(() => {})
  }, [resetAsync])

  return { isOnline, pendingCount, submit, undo, reset }
}
