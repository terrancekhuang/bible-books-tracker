import { useCallback, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { authHeaders } from './auth'
import { api } from './api'
import { useSyncContext } from './SyncContext'
import { useBooksContext } from './BooksContext'
import { getCache, setCache, invalidateProgress } from './cache'
import type { Book, Stats } from './trackerLogic'

export interface SyncOps {
  books: Book[]
  stats: Stats | null
  pendingCount: number
  isOnline: boolean
  submit: (book: Book, chapters: number[]) => Promise<void>
  undo: (book: Book) => Promise<void>
  reset: (book: Book) => Promise<void>
}

export function useProgressSync(): SyncOps {
  const { logout } = useAuth()
  const { isOnline, pendingCount, enqueue } = useSyncContext()
  const { books, patchBook } = useBooksContext()

  const [stats, setStats] = useState<Stats | null>(() => getCache<Stats>('stats'))

  const logoutRef = useRef(logout)
  logoutRef.current = logout

  const refreshStats = useCallback(async () => {
    const res = await fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, { headers: authHeaders() })
    if (!res.ok) return
    const data = await res.json() as Stats
    setStats(data)
    setCache('stats', data)
  }, [])

  const submit = useCallback(async (book: Book, chapters: number[]) => {
    if (chapters.length === 0) return
    const now = new Date().toISOString()
    const optimisticList = [...new Set([...book.chapters_read_list, ...chapters])].sort((a, b) => a - b)
    const newlyLogged = optimisticList.length - book.chapters_read_list.length
    const optimisticBook: Book = { ...book, chapters_read: optimisticList.length, chapters_read_list: optimisticList, last_read_at: now }

    patchBook(book.name, optimisticBook)
    if (newlyLogged > 0) {
      setStats(prev => prev ? { ...prev, chapters_today: prev.chapters_today + newlyLogged, total_chapters: prev.total_chapters + newlyLogged } : prev)
    }

    try {
      const response = await api.progress.submit(book.name, chapters)
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed')

      const confirmed: Book = { ...book, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list, last_read_at: now }
      patchBook(book.name, confirmed)

      if (data.newly_logged > 0) invalidateProgress()
      if (data.newly_logged > 0 || newlyLogged > 0) await refreshStats()
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        try {
          await enqueue('/api/progress', 'POST', authHeaders() as Record<string, string>, JSON.stringify({ book_name: book.name, chapters }))
        } catch {
          console.error('Failed to queue write; change will be lost if page is closed')
        }
      } else {
        patchBook(book.name, book)
        console.error('Error updating progress:', e)
      }
    }
  }, [refreshStats, enqueue, patchBook])

  const undo = useCallback(async (book: Book) => {
    try {
      const response = await api.progress.undo(book.name)
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!data.success) return
      patchBook(book.name, { ...book, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list })
      invalidateProgress()
      await refreshStats()
    } catch (e) {
      console.error('Error undoing progress:', e)
    }
  }, [refreshStats, patchBook])

  const reset = useCallback(async (book: Book) => {
    try {
      const response = await api.progress.reset(book.name)
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!data.success) return
      patchBook(book.name, { ...book, chapters_read: 0, chapters_read_list: [] })
      invalidateProgress()
      await refreshStats()
    } catch (e) {
      console.error('Error resetting progress:', e)
    }
  }, [refreshStats, patchBook])

  return { books, stats, pendingCount, isOnline, submit, undo, reset }
}
