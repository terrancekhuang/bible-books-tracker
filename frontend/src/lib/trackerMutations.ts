import { authHeaders } from './auth'
import { api } from './api'
import { invalidateProgressWrite } from './invalidation'
import { queryKeys } from './queryKeys'
import type { QueryClient } from '@tanstack/react-query'
import type { Book } from './trackerLogic'

/**
 * Tracker's three writes, as plain dependency-injected mutation-options factories.
 *
 * Nothing here imports React: each factory returns an object you hand straight to
 * `useMutation()`, which also makes every branch (optimistic update, rollback,
 * offline enqueue, 401) testable by calling the callbacks directly.
 */
export interface MutationDeps {
  queryClient: QueryClient
  logout: () => void
  enqueue: (url: string, method: string, headers: Record<string, string>, body: string) => Promise<void>
}

function setBook(deps: MutationDeps, name: string, book: Book): void {
  deps.queryClient.setQueryData<Book[]>(queryKeys.books(), (old) =>
    old?.map((b) => (b.name === name ? book : b))
  )
}

interface SubmitVars {
  book: Book
  chapters: number[]
}

/**
 * `queued` and `auth-failed` are deliberately results rather than throws: neither
 * should roll the optimistic update back. Queued writes replay on reconnect, and a
 * 401 has already logged the user out.
 */
type SubmitResult =
  | { status: 'confirmed'; chapters_read: number; chapters_read_list: number[]; newly_logged: number; last_entry: number[] }
  | { status: 'queued' }
  | { status: 'auth-failed' }

interface SubmitContext {
  previousBook: Book
  newlyLoggedOptimistic: number
}

export function createSubmitMutationOptions(deps: MutationDeps) {
  return {
    mutationFn: async ({ book, chapters }: SubmitVars): Promise<SubmitResult> => {
      try {
        const response = await api.progress.submit(book.name, chapters)
        if (response.status === 401) {
          deps.logout()
          return { status: 'auth-failed' as const }
        }
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed')
        return {
          status: 'confirmed' as const,
          chapters_read: data.chapters_read,
          chapters_read_list: data.chapters_read_list,
          newly_logged: data.newly_logged,
          last_entry: data.last_entry,
        }
      } catch (e) {
        // Offline or a network-level failure — hand the write to the offline queue
        // rather than losing it. A TypeError from fetch means the request never left.
        if (!navigator.onLine || e instanceof TypeError) {
          try {
            await deps.enqueue(
              '/api/progress',
              'POST',
              authHeaders() as Record<string, string>,
              JSON.stringify({ book_name: book.name, chapters }),
            )
          } catch {
            console.error('Failed to queue write; change will be lost if page is closed')
          }
          return { status: 'queued' as const }
        }
        throw e
      }
    },

    onMutate: async ({ book, chapters }: SubmitVars): Promise<SubmitContext> => {
      await deps.queryClient.cancelQueries({ queryKey: queryKeys.books() })
      const now = new Date().toISOString()
      const optimisticList = [...new Set([...book.chapters_read_list, ...chapters])].sort((a, b) => a - b)
      // Only chapters not already logged get a new row, so only they make up the new entry.
      const newlyLogged = optimisticList.filter((c) => !book.chapters_read_list.includes(c))
      const optimisticBook: Book = {
        ...book,
        chapters_read: optimisticList.length,
        chapters_read_list: optimisticList,
        last_read_at: now,
        last_entry: newlyLogged.length > 0 ? newlyLogged : book.last_entry,
      }
      setBook(deps, book.name, optimisticBook)
      return {
        previousBook: book,
        newlyLoggedOptimistic: optimisticList.length - book.chapters_read_list.length,
      }
    },

    onError: (error: unknown, { book }: SubmitVars, context: SubmitContext | undefined) => {
      setBook(deps, book.name, context?.previousBook ?? book)
      console.error('Error updating progress:', error)
    },

    onSuccess: (result: SubmitResult, { book }: SubmitVars, context: SubmitContext | undefined) => {
      if (result.status !== 'confirmed') return
      const confirmed: Book = {
        ...book,
        chapters_read: result.chapters_read,
        chapters_read_list: result.chapters_read_list,
        last_read_at: new Date().toISOString(),
        last_entry: result.last_entry,
      }
      setBook(deps, book.name, confirmed)
      if (result.newly_logged > 0 || (context?.newlyLoggedOptimistic ?? 0) > 0) {
        invalidateProgressWrite(deps.queryClient)
      }
    },
  }
}

interface ActionVars {
  book: Book
}

interface ActionResult {
  success: boolean
  chapters_read: number
  chapters_read_list: number[]
  last_entry: number[]
}

/**
 * Undo and reset share a shape: unlike submit, neither is optimistic — the book is
 * only patched once the server responds. That asymmetry is intentional and matches
 * the behaviour before this migration.
 */
function createBookActionMutationOptions(
  deps: MutationDeps,
  call: (bookName: string) => Promise<Response>,
  errorLabel: string,
) {
  return {
    mutationFn: async ({ book }: ActionVars): Promise<ActionResult | null> => {
      const response = await call(book.name)
      if (response.status === 401) {
        deps.logout()
        return null
      }
      return await response.json() as ActionResult
    },

    onSuccess: (data: ActionResult | null, { book }: ActionVars) => {
      // `success: false` is the "nothing left to undo" case — not an error, just a no-op.
      if (!data?.success) return
      setBook(deps, book.name, {
        ...book,
        chapters_read: data.chapters_read,
        chapters_read_list: data.chapters_read_list,
        last_entry: data.last_entry,
      })
      invalidateProgressWrite(deps.queryClient)
    },

    onError: (error: unknown) => {
      console.error(`Error ${errorLabel}:`, error)
    },
  }
}

export function createUndoMutationOptions(deps: MutationDeps) {
  return createBookActionMutationOptions(deps, api.progress.undo, 'undoing progress')
}

export function createResetMutationOptions(deps: MutationDeps) {
  return createBookActionMutationOptions(deps, api.progress.reset, 'resetting progress')
}
