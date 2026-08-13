import { useMemo } from 'react'
import { useQuery, queryOptions } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { fetchJson, UnauthorizedError } from './api'
import { normalizeBook } from './BooksContext'
import { getCache, setCache } from './cache'
import { queryKeys } from './queryKeys'
import type { Book, Stats } from './trackerLogic'
import type { ActivityDay } from '../components/ActivityHeatmap'

export interface CurrentUser {
  name: string | null
  picture_url: string | null
}

/** The whole `/api/dashboard` payload — stats, heatmap, weekly goal and nav-bar user in one request. */
export interface DashboardData {
  stats: Stats
  activity: ActivityDay[]
  weekly_goal: number
  user: CurrentUser
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

export function dashboardQueryOptions({ logout, tzOffset }: QueryDeps & { tzOffset: number }) {
  return queryOptions({
    queryKey: queryKeys.dashboard(tzOffset),
    queryFn: async (): Promise<DashboardData> => {
      const data = await getJson<DashboardData>(`/api/dashboard?tz_offset=${tzOffset}`, logout)
      // LEGACY BRIDGE: mirror the write-back useCachedFetch used to do, so the seed
      // below stays alive. Load-bearing, not just belt-and-braces: invalidateProgress()
      // deletes cache:dashboard on every Tracker write, and nothing else repopulates it
      // now that useCachedFetch no longer serves this key — without this the seed would
      // be dead after the first write. Goes with cache.ts in milestone 4.
      setCache('dashboard', data)
      return data
    },
    // LEGACY BRIDGE: same reasoning as the books seed above — TanStack's cache is
    // in-memory only until milestone 4's persister, so without this the Dashboard
    // would show skeletons on every hard reload where today it paints instantly.
    initialData: () => getCache<DashboardData>('dashboard') ?? undefined,
    initialDataUpdatedAt: 0,
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

/**
 * Minutes east of UTC, stable for the session.
 * Shared so the dashboard query and the writes that invalidate it can't key off
 * two different offsets.
 */
export function useTzOffset(): number {
  return useMemo(() => -new Date().getTimezoneOffset(), [])
}

export function useDashboardQuery() {
  const { logout } = useAuth()
  const tzOffset = useTzOffset()
  return useQuery(dashboardQueryOptions({ logout, tzOffset }))
}
