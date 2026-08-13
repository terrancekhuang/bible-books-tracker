import { useMemo } from 'react'
import { useQuery, queryOptions } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { fetchJson, UnauthorizedError } from './api'
import { normalizeBook } from './BooksContext'
import { getCache, setCache } from './cache'
import { queryKeys } from './queryKeys'
import type { Book, Stats } from './trackerLogic'
import type { ActivityDay } from '../components/ActivityHeatmap'

/** The nav-bar slice of a user — all `/api/dashboard` embeds, and all NavBar needs. */
export interface CurrentUser {
  name: string | null
  picture_url: string | null
}

/** `/auth/me` returns more than the dashboard's embedded user; Profile shows the rest. */
export interface AuthUser extends CurrentUser {
  user_id: number
  email: string
}

/** The whole `/api/dashboard` payload — stats, heatmap, weekly goal and nav-bar user in one request. */
export interface DashboardData {
  stats: Stats
  activity: ActivityDay[]
  weekly_goal: number
  user: CurrentUser
}

/** One reading cycle with its aggregate progress, from `/api/cycles`. */
export interface Cycle {
  cycle_id: number
  cycle_number: number
  chapters_read: number
  total_chapters: number
  books_complete: number
}

/** A most-read book, from `/api/favorites` — `cycle_count` is how many cycles it appears in. */
export interface FavoriteBook {
  book_id: number
  book_name: string
  cycle_count: number
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

/**
 * LEGACY BRIDGE: paints every page instantly on a hard reload, the way the old
 * localStorage cache did. TanStack's cache is in-memory only until milestone 4 adds a
 * real persister, so without this seed each page would flash empty or show skeletons
 * where today it shows last-known values. `initialDataUpdatedAt: 0` marks the seed as
 * already stale, so it always background-refetches — again matching today.
 *
 * The paired `setCache(key, data)` in each queryFn below is what keeps the seed alive:
 * useCachedFetch used to write these keys, and invalidateProgress()/invalidateCycle()
 * still delete them on every write, so without the write-back a seed would be dead
 * after the user's first write. Both halves go with cache.ts in milestone 4.
 */
function legacySeed<T>(key: string) {
  return {
    initialData: () => getCache<T>(key) ?? undefined,
    initialDataUpdatedAt: 0,
  }
}

export function booksQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.books(),
    queryFn: async (): Promise<Book[]> => {
      const books = await getJson<Book[]>('/api/books', logout)
      return books.map(normalizeBook)
    },
    // BooksContext, not this queryFn, is still what writes cache:books.
    ...legacySeed<Book[]>('books'),
  })
}

export function currentUserQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.currentUser(),
    queryFn: async (): Promise<AuthUser> => {
      const data = await getJson<AuthUser>('/auth/me', logout)
      setCache('user', data)
      return data
    },
    ...legacySeed<AuthUser>('user'),
  })
}

export function dashboardQueryOptions({ logout, tzOffset }: QueryDeps & { tzOffset: number }) {
  return queryOptions({
    queryKey: queryKeys.dashboard(tzOffset),
    queryFn: async (): Promise<DashboardData> => {
      const data = await getJson<DashboardData>(`/api/dashboard?tz_offset=${tzOffset}`, logout)
      setCache('dashboard', data)
      return data
    },
    ...legacySeed<DashboardData>('dashboard'),
  })
}

export function cyclesQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.cycles(),
    queryFn: async (): Promise<Cycle[]> => {
      const data = await getJson<Cycle[]>('/api/cycles', logout)
      setCache('cycles', data)
      return data
    },
    ...legacySeed<Cycle[]>('cycles'),
  })
}

export function favoritesQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.favorites(),
    queryFn: async (): Promise<FavoriteBook[]> => {
      const data = await getJson<FavoriteBook[]>('/api/favorites', logout)
      setCache('favorites', data)
      return data
    },
    ...legacySeed<FavoriteBook[]>('favorites'),
  })
}

export function statsQueryOptions({ logout, tzOffset }: QueryDeps & { tzOffset: number }) {
  return queryOptions({
    queryKey: queryKeys.stats(tzOffset),
    queryFn: async (): Promise<Stats> => {
      const data = await getJson<Stats>(`/api/stats?tz_offset=${tzOffset}`, logout)
      setCache('stats', data)
      return data
    },
    ...legacySeed<Stats>('stats'),
  })
}

// Named for the data, not the page — every page reuses these rather than
// defining queries of its own.

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

export function useCyclesQuery() {
  const { logout } = useAuth()
  return useQuery(cyclesQueryOptions({ logout }))
}

export function useFavoritesQuery() {
  const { logout } = useAuth()
  return useQuery(favoritesQueryOptions({ logout }))
}

export function useStatsQuery() {
  const { logout } = useAuth()
  const tzOffset = useTzOffset()
  return useQuery(statsQueryOptions({ logout, tzOffset }))
}
