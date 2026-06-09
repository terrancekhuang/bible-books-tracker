import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { authHeaders } from './auth'
import { api } from './api'
import { useSyncContext } from './SyncContext'
import { getCache, setCache, invalidateProgress } from './cache'
import type { Book, Stats } from './trackerLogic'

function normalizeBook(item: Book): Book {
  return {
    book_id: item.book_id,
    name: item.name,
    testament: item.testament,
    category: item.category,
    num_chapters: item.num_chapters,
    chapters_read: item.chapters_read,
    chapters_read_list: item.chapters_read_list || [],
    last_read_at: item.last_read_at ?? null,
  }
}

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

  const [books, setBooks] = useState<Book[]>(() => getCache<Book[]>('books') ?? [])
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

  const refreshBooks = useCallback(async () => {
    const res = await fetch('/api/books', { headers: authHeaders() })
    if (res.status === 401) { logoutRef.current(); return }
    if (!res.ok) return
    const data = (await res.json() as Book[]).map(normalizeBook)
    setBooks(data)
    setCache('books', data)
  }, [])

  // Initial load
  useEffect(() => {
    refreshBooks()
  }, [refreshBooks])

  // Initial stats load
  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  // Re-fetch books after SyncContext flushes pending writes
  useEffect(() => {
    const handle = () => refreshBooks()
    window.addEventListener('books-invalidated', handle)
    return () => window.removeEventListener('books-invalidated', handle)
  }, [refreshBooks])

  const submit = useCallback(async (book: Book, chapters: number[]) => {
    if (chapters.length === 0) return
    const now = new Date().toISOString()
    const optimisticList = [...new Set([...book.chapters_read_list, ...chapters])].sort((a, b) => a - b)
    const newlyLogged = optimisticList.length - book.chapters_read_list.length
    const optimisticBook: Book = { ...book, chapters_read: optimisticList.length, chapters_read_list: optimisticList, last_read_at: now }

    setBooks(prev => prev.map(b => b.name === book.name ? optimisticBook : b))
    if (newlyLogged > 0) {
      setStats(prev => prev ? { ...prev, chapters_today: prev.chapters_today + newlyLogged, total_chapters: prev.total_chapters + newlyLogged } : prev)
    }

    try {
      const response = await api.progress.submit(book.name, chapters)
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed')

      const confirmed: Book = { ...book, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list, last_read_at: now }
      setBooks(prev => prev.map(b => b.name === book.name ? confirmed : b))
      const cached = getCache<Book[]>('books')
      if (cached) setCache('books', cached.map(b => b.name === book.name ? confirmed : b))

      if (data.newly_logged > 0) {
        invalidateProgress()
        await refreshStats()
      }
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        try {
          await enqueue('/api/progress', 'POST', authHeaders() as Record<string, string>, JSON.stringify({ book_name: book.name, chapters }))
        } catch {
          console.error('Failed to queue write; change will be lost if page is closed')
        }
      } else {
        setBooks(prev => prev.map(b => b.name === book.name ? book : b))
        console.error('Error updating progress:', e)
      }
    }
  }, [refreshStats, enqueue])

  const undo = useCallback(async (book: Book) => {
    try {
      const response = await api.progress.undo(book.name)
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!data.success) return
      const updated: Book = { ...book, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list }
      setBooks(prev => prev.map(b => b.name === book.name ? updated : b))
      const cached = getCache<Book[]>('books')
      if (cached) setCache('books', cached.map(b => b.name === book.name ? updated : b))
      invalidateProgress()
      await refreshStats()
    } catch (e) {
      console.error('Error undoing progress:', e)
    }
  }, [refreshStats])

  const reset = useCallback(async (book: Book) => {
    try {
      const response = await api.progress.reset(book.name)
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!data.success) return
      const updated: Book = { ...book, chapters_read: 0, chapters_read_list: [] }
      setBooks(prev => prev.map(b => b.name === book.name ? updated : b))
      const cached = getCache<Book[]>('books')
      if (cached) setCache('books', cached.map(b => b.name === book.name ? updated : b))
      invalidateProgress()
      await refreshStats()
    } catch (e) {
      console.error('Error resetting progress:', e)
    }
  }, [refreshStats])

  return { books, stats, pendingCount, isOnline, submit, undo, reset }
}
