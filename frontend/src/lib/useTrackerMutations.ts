import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { useSyncContext } from './SyncContext'
import { createSubmitMutationOptions, createUndoMutationOptions, createResetMutationOptions } from './trackerMutations'
import type { MutationDeps } from './trackerMutations'
import { nextChapter, type Book } from './trackerLogic'

interface TrackerMutations {
  isOnline: boolean
  pendingCount: number
  submit: (book: Book, chapters: number[]) => Promise<boolean>
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
  // Resolves to false only for that rolled-back case, so a caller can show an inline
  // error; a queued or auth-failed write kept its optimistic update and counts as true.
  const submit = useCallback(async (book: Book, chapters: number[]) => {
    if (chapters.length === 0) return true
    return submitAsync({ book, chapters }).then(() => true, () => false)
  }, [submitAsync])

  const undo = useCallback(async (book: Book) => {
    await undoAsync({ book }).catch(() => {})
  }, [undoAsync])

  const reset = useCallback(async (book: Book) => {
    await resetAsync({ book }).catch(() => {})
  }, [resetAsync])

  return { isOnline, pendingCount, submit, undo, reset }
}

/**
 * One-tap "mark the next chapter read", shared by the Dashboard's Continue Reading rows and
 * the Tracker's book list (checkmark and `n`). submit patches the cache optimistically and
 * rolls back itself on failure, so the row advances at once; offline it queues and still
 * counts as saved. A book with a mark in flight ignores further marks, so a double tap or a
 * held key logs one chapter — the ref guards that, the state drives the disabled button.
 */
export function useMarkNext(submit: TrackerMutations['submit']) {
  const inFlight = useRef(new Set<string>())
  const [markingBooks, setMarkingBooks] = useState<string[]>([])
  const [markError, setMarkError] = useState<string | null>(null)

  const markNext = useCallback(async (book: Book) => {
    const next = nextChapter(book)
    if (next === null || inFlight.current.has(book.name)) return
    inFlight.current.add(book.name)
    setMarkError(null)
    setMarkingBooks(m => [...m, book.name])
    const saved = await submit(book, [next])
    inFlight.current.delete(book.name)
    setMarkingBooks(m => m.filter(n => n !== book.name))
    if (!saved) setMarkError(book.name)
  }, [submit])

  return { markNext, markingBooks, markError }
}
