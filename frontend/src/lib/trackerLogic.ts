export interface Book {
  book_id: number
  name: string
  testament: string
  category: string
  num_chapters: number
  chapters_read: number
  chapters_read_list: number[]
  last_read_at: string | null
}

/** The full `/api/stats` payload — also nested inside `/api/dashboard`. */
export interface Stats {
  chapters_today: number
  chapters_this_week: number
  chapters_last_7_days: number
  current_streak: number
  best_streak: number
  total_chapters: number
  total_days: number
}

export type SortKey = 'name' | 'chapters_read' | 'percent' | 'status'
export type SortDir = 'asc' | 'desc'

export const TOTAL_CHAPTERS = 1189
export const TOTAL_BOOKS = 66

export function parseChapters(input: string, max: number): number[] {
  if (!input.trim()) return []
  const result = new Set<number>()
  for (const part of input.split(',').map(s => s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim()))
      if (isNaN(a) || isNaN(b) || a > b || a < 1 || b > max) return []
      for (let i = a; i <= b; i++) result.add(i)
    } else {
      const n = parseInt(part)
      if (isNaN(n) || n < 1 || n > max) return []
      result.add(n)
    }
  }
  return [...result].sort((a, b) => a - b)
}

export interface ChapterSplit {
  /** Chapters that would actually be logged — the parsed input minus what's already read. */
  newChapters: number[]
  /** Chapters in the parsed input that this book has already logged. */
  alreadyRead: number[]
}

/**
 * Splits a parsed chapter list against a book's existing progress.
 *
 * The backend already dedupes on write, so re-submitting a read chapter is a silent
 * no-op. Splitting here lets the UI say so before the user presses Submit.
 */
export function splitAlreadyRead(parsed: number[], chaptersReadList: number[]): ChapterSplit {
  const read = new Set(chaptersReadList)
  const newChapters: number[] = []
  const alreadyRead: number[] = []
  for (const chapter of parsed) {
    if (read.has(chapter)) alreadyRead.push(chapter)
    else newChapters.push(chapter)
  }
  return { newChapters, alreadyRead }
}

/** Renders a chapter list for the hint under the input, truncating past 8 entries. */
export function formatChapterList(chapters: number[], limit = 8): string {
  return `${chapters.slice(0, limit).join(', ')}${chapters.length > limit ? '…' : ''}`
}

export function calculateProgress(book: Pick<Book, 'chapters_read' | 'num_chapters'>): number {
  if (!book.chapters_read) return 0
  return Math.round((book.chapters_read / book.num_chapters) * 100)
}

export function calculateOverallProgress(books: Book[]): { totalRead: number; overallPct: number } {
  const totalRead = books.reduce((s, b) => s + b.chapters_read, 0)
  return { totalRead, overallPct: Math.round((totalRead / TOTAL_CHAPTERS) * 100) }
}

function statusRank(book: Book): number {
  if (book.chapters_read >= book.num_chapters) return 2
  if (book.chapters_read > 0) return 1
  return 0
}

export function sortBooks(books: Book[], sortKey: SortKey | null, sortDir: SortDir): Book[] {
  if (sortKey === null) return books
  return [...books].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'chapters_read') cmp = a.chapters_read - b.chapters_read
    else if (sortKey === 'percent') cmp = calculateProgress(a) - calculateProgress(b)
    else if (sortKey === 'status') cmp = statusRank(a) - statusRank(b)
    return sortDir === 'asc' ? cmp : -cmp
  })
}

export interface FilterOpts {
  search: string
  filterTestament: string
  filterCategory: string
  filterStatus: string
}

export function filterBooks(books: Book[], { search, filterTestament, filterCategory, filterStatus }: FilterOpts): Book[] {
  return books.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTestament && b.testament !== filterTestament) return false
    if (filterCategory && b.category !== filterCategory) return false
    if (filterStatus) {
      const isComplete = b.chapters_read >= b.num_chapters
      const inProgress = b.chapters_read > 0 && !isComplete
      if (filterStatus === 'complete' && !isComplete) return false
      if (filterStatus === 'in_progress' && !inProgress) return false
      if (filterStatus === 'not_started' && b.chapters_read > 0) return false
    }
    return true
  })
}

export function availableFilterOptions(
  books: Book[],
  { filterTestament, filterCategory }: { filterTestament: string; filterCategory: string }
): { testaments: string[]; categories: string[] } {
  return {
    testaments: [...new Set(books.filter(b => !filterCategory || b.category === filterCategory).map(b => b.testament))],
    categories: [...new Set(books.filter(b => !filterTestament || b.testament === filterTestament).map(b => b.category))],
  }
}
