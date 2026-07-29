import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getCache, setCache } from './cache'
import { fetchJson } from './api'
import type { Book } from './trackerLogic'

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

interface BooksContextValue {
  books: Book[]
  refreshBooks: () => Promise<void>
  patchBook: (name: string, book: Book) => void
}

const BooksContext = createContext<BooksContextValue | null>(null)

export function BooksProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth()

  const [books, setBooks] = useState<Book[]>(() => getCache<Book[]>('books') ?? [])

  const refreshBooks = useCallback(async () => {
    const result = await fetchJson<Book[]>('/api/books', logout)
    if (!result.ok) return
    const data = result.data.map(normalizeBook)
    setBooks(data)
    setCache('books', data)
  }, [logout])

  useEffect(() => {
    refreshBooks()
  }, [refreshBooks])

  // Refetch when SyncContext finishes flushing pending writes
  useEffect(() => {
    const handle = () => refreshBooks()
    window.addEventListener('books-invalidated', handle)
    return () => window.removeEventListener('books-invalidated', handle)
  }, [refreshBooks])

  const patchBook = useCallback((name: string, book: Book) => {
    setBooks(prev => {
      const updated = prev.map(b => b.name === name ? book : b)
      setCache('books', updated)
      return updated
    })
  }, [])

  return (
    <BooksContext.Provider value={{ books, refreshBooks, patchBook }}>
      {children}
    </BooksContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBooksContext(): BooksContextValue {
  const ctx = useContext(BooksContext)
  if (!ctx) throw new Error('useBooksContext must be used inside BooksProvider')
  return ctx
}
