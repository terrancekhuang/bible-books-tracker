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

export type SegmentState = 'read' | 'logging' | 'pending' | 'unread'

export interface ChapterRun {
  start: number
  end: number
  state: SegmentState
}

/**
 * Collapses chapters 1..total into runs of a single state, for the segmented bar.
 *
 * `read` wins over `pending`: a chapter that's already logged stays solid even when the
 * user types it again, because re-submitting it is a no-op.
 *
 * `logging` is the read state mid-animation — chapters the bar is still filling in after a
 * write. It outranks the rest: the optimistic cache write lands a frame or two after the
 * caller sets it, and gating on `read` would let those chapters blink through unread first.
 * The caller is what bounds it, by clearing the set once the fill has run.
 */
export function buildChapterRuns(
  total: number,
  read: number[],
  pending: number[] = [],
  logging: number[] = [],
): ChapterRun[] {
  const readSet = new Set(read)
  const pendingSet = new Set(pending)
  const loggingSet = new Set(logging)
  const runs: ChapterRun[] = []
  for (let i = 1; i <= total; i++) {
    const state: SegmentState = loggingSet.has(i) ? 'logging'
      : readSet.has(i) ? 'read'
      : pendingSet.has(i) ? 'pending' : 'unread'
    const last = runs[runs.length - 1]
    if (!last || last.state !== state) runs.push({ start: i, end: i, state })
    else last.end = i
  }
  return runs
}

/** Renders a chapter list for the hint under the input, truncating past 8 entries. */
export function formatChapterList(chapters: number[], limit = 8): string {
  return `${chapters.slice(0, limit).join(', ')}${chapters.length > limit ? '…' : ''}`
}

/** The hint shown under the chapter-entry field when its input doesn't parse. Names the
 *  book's real chapter count so "out of range" reads as a fact about the book, not a
 *  generic syntax complaint. */
export function invalidChaptersMessage(bookName: string, numChapters: number): string {
  return `${bookName} has ${numChapters} chapters — try "1-5" or "3, 7, 12"`
}

export function calculateProgress(book: Pick<Book, 'chapters_read' | 'num_chapters'>): number {
  if (!book.chapters_read) return 0
  return Math.round((book.chapters_read / book.num_chapters) * 100)
}

export function calculateOverallProgress(books: Book[]): { totalRead: number; overallPct: number } {
  const totalRead = books.reduce((s, b) => s + b.chapters_read, 0)
  return { totalRead, overallPct: Math.round((totalRead / TOTAL_CHAPTERS) * 100) }
}

/** The book a volume opens to by default: the first with unread chapters, or the first
 *  book if the whole volume is already complete. Mirrors the approved Volumes prototype's
 *  spine-click behaviour, so opening a volume is fast to log straight into. */
export function defaultBookForCategory(books: Book[], category: string): Book | null {
  const inCategory = books.filter(b => b.category === category)
  return inCategory.find(b => b.chapters_read < b.num_chapters) ?? inCategory[0] ?? null
}

export interface FilterOpts {
  search: string
  filterTestament: string
  filterStatus: string
}

export function filterBooks(books: Book[], { search, filterTestament, filterStatus }: FilterOpts): Book[] {
  return books.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTestament && b.testament !== filterTestament) return false
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
