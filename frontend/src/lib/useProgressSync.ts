import { useCallback, useEffect, useRef, useState } from 'react'
import { authHeaders } from './auth'
import { enqueueWrite, flushQueue, getPendingCount } from './offlineQueue'
import { getCache, setCache, invalidateCache } from './cache'
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

export function useProgressSync(logout: () => void): SyncOps {
  const [books, setBooks] = useState<Book[]>(() => getCache<Book[]>('books') ?? [])
  const [stats, setStats] = useState<Stats | null>(() => getCache<Stats>('stats'))
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  // Stable ref so effects/callbacks don't re-run when logout identity changes
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

  // Initial load: check pending count, flush queue, fetch books
  useEffect(() => {
    getPendingCount().then(setPendingCount)
    const load = async () => {
      if (navigator.onLine) await flushQueue(logoutRef.current)
      await refreshBooks()
    }
    load()
  }, [refreshBooks])

  // Initial stats load
  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      await flushQueue(logoutRef.current)
      const n = await getPendingCount()
      setPendingCount(n)
      if (n === 0) await refreshBooks()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
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

    const body = JSON.stringify({ book_name: book.name, chapters })
    const headers = authHeaders() as Record<string, string>

    try {
      const response = await fetch('/api/progress', { method: 'POST', headers, body })
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed')

      const confirmed: Book = { ...book, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list, last_read_at: now }
      setBooks(prev => prev.map(b => b.name === book.name ? confirmed : b))
      const cached = getCache<Book[]>('books')
      if (cached) setCache('books', cached.map(b => b.name === book.name ? confirmed : b))

      if (data.newly_logged > 0) {
        invalidateCache('activity')
        await refreshStats()
      }
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        try {
          await enqueueWrite('/api/progress', 'POST', headers, body)
          setPendingCount(c => c + 1)
        } catch {
          console.error('Failed to queue write; change will be lost if page is closed')
        }
      } else {
        // Rollback optimistic update
        setBooks(prev => prev.map(b => b.name === book.name ? book : b))
        console.error('Error updating progress:', e)
      }
    }
  }, [refreshStats])

  const undo = useCallback(async (book: Book) => {
    try {
      const response = await fetch('/api/progress/undo', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ book_name: book.name }),
      })
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!data.success) return
      const updated: Book = { ...book, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list }
      setBooks(prev => prev.map(b => b.name === book.name ? updated : b))
      const cached = getCache<Book[]>('books')
      if (cached) setCache('books', cached.map(b => b.name === book.name ? updated : b))
      invalidateCache('activity')
      await refreshStats()
    } catch (e) {
      console.error('Error undoing progress:', e)
    }
  }, [refreshStats])

  const reset = useCallback(async (book: Book) => {
    try {
      const response = await fetch('/api/progress/reset', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ book_name: book.name }),
      })
      if (response.status === 401) { logoutRef.current(); return }
      const data = await response.json()
      if (!data.success) return
      const updated: Book = { ...book, chapters_read: 0, chapters_read_list: [] }
      setBooks(prev => prev.map(b => b.name === book.name ? updated : b))
      const cached = getCache<Book[]>('books')
      if (cached) setCache('books', cached.map(b => b.name === book.name ? updated : b))
      invalidateCache('activity')
      await refreshStats()
    } catch (e) {
      console.error('Error resetting progress:', e)
    }
  }, [refreshStats])

  return { books, stats, pendingCount, isOnline, submit, undo, reset }
}
