import { useQuery, queryOptions } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { fetchJson, UnauthorizedError } from './api'
import { normalizeBook } from './BooksContext'
import { getCache } from './cache'
import { queryKeys } from './queryKeys'
import type { Book } from './trackerLogic'

export interface CurrentUser {
  name: string | null
  picture_url: string | null
}

interface QueryDeps {
  logout: () => void
}

/** fetchJson swallows failures into a result object; queries need a throw instead. */
async function getJson<T>(url: string, logout: () => void): Promise<T> {
  const result = await fetchJson<T>(url, logout)
  if (result.ok) return result.data
  if (result.unauthorized) throw new UnauthorizedError()
  throw new Error(`Failed to fetch ${url}`)
}

export function booksQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.books(),
    queryFn: async (): Promise<Book[]> => {
      const books = await getJson<Book[]>('/api/books', logout)
      return books.map(normalizeBook)
    },
    // LEGACY BRIDGE: BooksContext seeds itself synchronously from localStorage, so
    // today the grid paints instantly on a hard reload. TanStack's cache is
    // in-memory only until milestone 4 adds a real persister — without this seed
    // the grid would flash empty on every reload. `initialDataUpdatedAt: 0` marks
    // the seed as already stale so it always background-refetches, matching today.
    initialData: () => getCache<Book[]>('books') ?? undefined,
    initialDataUpdatedAt: 0,
  })
}

export function currentUserQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.currentUser(),
    queryFn: (): Promise<CurrentUser> => getJson<CurrentUser>('/auth/me', logout),
  })
}

// Named for the data, not the page — Dashboard and Profile reuse these in
// milestones 2 and 3 rather than defining queries of their own.

export function useBooksQuery() {
  const { logout } = useAuth()
  return useQuery(booksQueryOptions({ logout }))
}

export function useCurrentUserQuery() {
  const { logout } = useAuth()
  return useQuery(currentUserQueryOptions({ logout }))
}
