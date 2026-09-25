export interface Book {
  book_id: number
  name: string
  testament: string
  category: string
  num_chapters: number
  chapters_read: number
  chapters_read_list: number[]
  last_read_at: string | null
  /** The chapters Undo would remove — the most recent entry. Missing from books cached
   *  before the field existed, until the next refetch. */
  last_entry?: number[]
}

/** The `stats` object nested inside `/api/dashboard`. */
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

interface ChapterSplit {
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

interface ChapterRun {
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
/** Sorted chapters as ranges: [1, 2, 3, 5, 7, 8] → "1–3, 5, 7–8". */
export function formatChapterRanges(chapters: number[]): string {
  const parts: string[] = []
  for (let i = 0; i < chapters.length; i++) {
    const start = chapters[i]
    while (chapters[i + 1] === chapters[i] + 1) i++
    parts.push(start === chapters[i] ? `${start}` : `${start}–${chapters[i]}`)
  }
  return parts.join(', ')
}

export function formatChapterList(chapters: number[], limit = 8): string {
  return `${chapters.slice(0, limit).join(', ')}${chapters.length > limit ? '…' : ''}`
}

/**
 * Why `input` didn't parse. A format error wins over an out-of-range chapter: once the
 * input parses, the hint moves on to quoting every part that runs past the book's end.
 */
export function invalidChaptersMessage(bookName: string, numChapters: number, input: string): string {
  const count = `${bookName} has ${numChapters} chapter${numChapters === 1 ? '' : 's'}`
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  // With no upper bound, the only way a part fails to parse is its format.
  if (parts.some(p => parseChapters(p, Infinity).length === 0)) {
    if (numChapters === 1) return `${count} — enter "1"`
    return `${bookName}: try "1-${numChapters}" or "1, ${numChapters}"`
  }
  const over = parts.filter(p => parseChapters(p, numChapters).length === 0)
  // Tracker builds the hint on every render, including for empty or valid input.
  if (over.length === 0) return ''
  const verb = over.length > 1
    ? (over.some(p => p.includes('-')) ? 'go' : 'are')
    : (over[0].includes('-') ? 'runs' : 'is')
  return `${count} — ${over.map(p => `"${p}"`).join(', ')} ${verb} past the end`
}

export function calculateProgress(book: Pick<Book, 'chapters_read' | 'num_chapters'>): number {
  if (!book.chapters_read) return 0
  return Math.round((book.chapters_read / book.num_chapters) * 100)
}

export function calculateOverallProgress(books: Book[]): { totalRead: number; overallPct: number } {
  const totalRead = books.reduce((s, b) => s + b.chapters_read, 0)
  return { totalRead, overallPct: Math.round((totalRead / TOTAL_CHAPTERS) * 100) }
}

interface FilterOpts {
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
