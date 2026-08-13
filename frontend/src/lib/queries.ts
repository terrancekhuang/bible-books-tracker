import { useMemo } from 'react'
import { useQuery, queryOptions } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { fetchJson, UnauthorizedError } from './api'
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

/** Fills in the two fields the API may omit, so consumers never guard for them. */
function normalizeBook(item: Book): Book {
  return {
    ...item,
    chapters_read_list: item.chapters_read_list || [],
    last_read_at: item.last_read_at ?? null,
  }
}

export function booksQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.books(),
    queryFn: async (): Promise<Book[]> => {
      const books = await getJson<Book[]>('/api/books', logout)
      return books.map(normalizeBook)
    },
  })
}

export function currentUserQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.currentUser(),
    queryFn: (): Promise<AuthUser> => getJson<AuthUser>('/auth/me', logout),
  })
}

export function dashboardQueryOptions({ logout, tzOffset }: QueryDeps & { tzOffset: number }) {
  return queryOptions({
    queryKey: queryKeys.dashboard(tzOffset),
    queryFn: (): Promise<DashboardData> =>
      getJson<DashboardData>(`/api/dashboard?tz_offset=${tzOffset}`, logout),
  })
}

export function cyclesQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.cycles(),
    queryFn: (): Promise<Cycle[]> => getJson<Cycle[]>('/api/cycles', logout),
  })
}

export function favoritesQueryOptions({ logout }: QueryDeps) {
  return queryOptions({
    queryKey: queryKeys.favorites(),
    queryFn: (): Promise<FavoriteBook[]> => getJson<FavoriteBook[]>('/api/favorites', logout),
  })
}

export function statsQueryOptions({ logout, tzOffset }: QueryDeps & { tzOffset: number }) {
  return queryOptions({
    queryKey: queryKeys.stats(tzOffset),
    queryFn: (): Promise<Stats> => getJson<Stats>(`/api/stats?tz_offset=${tzOffset}`, logout),
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
