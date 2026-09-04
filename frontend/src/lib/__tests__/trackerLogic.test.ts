import { describe, it, expect } from 'vitest'
import {
  parseChapters,
  splitAlreadyRead,
  buildChapterRuns,
  formatChapterList,
  calculateProgress,
  filterBooks,
  invalidChaptersMessage,
  defaultBookForCategory,
  type Book,
} from '../trackerLogic'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    book_id: 1,
    name: 'Genesis',
    testament: 'Old Testament',
    category: 'Law',
    num_chapters: 50,
    chapters_read: 0,
    chapters_read_list: [],
    last_read_at: null,
    ...overrides,
  }
}

describe('parseChapters', () => {
  it('parses a single valid chapter', () => {
    expect(parseChapters('1', 10)).toEqual([1])
  })

  it('parses a range', () => {
    expect(parseChapters('1-3', 5)).toEqual([1, 2, 3])
  })

  it('parses a comma-separated list', () => {
    expect(parseChapters('1,3,5', 10)).toEqual([1, 3, 5])
  })

  it('parses mixed ranges and single chapters', () => {
    expect(parseChapters('1-3,5', 10)).toEqual([1, 2, 3, 5])
  })

  it('deduplicates chapters', () => {
    expect(parseChapters('1,1,2', 10)).toEqual([1, 2])
  })

  it('sorts output ascending', () => {
    expect(parseChapters('3,1,2', 10)).toEqual([1, 2, 3])
  })

  it('returns empty for empty input', () => {
    expect(parseChapters('', 10)).toEqual([])
  })

  it('returns empty for whitespace-only input', () => {
    expect(parseChapters('  ', 10)).toEqual([])
  })

  it('returns empty for chapter 0 (below min)', () => {
    expect(parseChapters('0', 10)).toEqual([])
  })

  it('returns empty for chapter above max', () => {
    expect(parseChapters('11', 10)).toEqual([])
  })

  it('returns empty for reversed range (a > b)', () => {
    expect(parseChapters('5-3', 10)).toEqual([])
  })

  it('returns empty for non-numeric input', () => {
    expect(parseChapters('abc', 10)).toEqual([])
  })

  it('returns empty for partial NaN in range', () => {
    expect(parseChapters('1-abc', 10)).toEqual([])
  })

  it('accepts the maximum chapter exactly', () => {
    expect(parseChapters('10', 10)).toEqual([10])
  })

  it('trims whitespace around parts', () => {
    expect(parseChapters(' 1 , 2 ', 10)).toEqual([1, 2])
  })

  it('filters any out-of-range chapter inside a comma list', () => {
    expect(parseChapters('1,0', 10)).toEqual([])
  })
})

describe('calculateProgress', () => {
  it('returns 0 when no chapters read', () => {
    expect(calculateProgress(makeBook({ chapters_read: 0, num_chapters: 10 }))).toBe(0)
  })

  it('returns 100 when all chapters read', () => {
    expect(calculateProgress(makeBook({ chapters_read: 10, num_chapters: 10 }))).toBe(100)
  })

  it('returns rounded percentage for partial progress', () => {
    expect(calculateProgress(makeBook({ chapters_read: 1, num_chapters: 3 }))).toBe(33)
  })

  it('rounds up at the midpoint', () => {
    expect(calculateProgress(makeBook({ chapters_read: 1, num_chapters: 2 }))).toBe(50)
  })
})

describe('filterBooks', () => {
  const books: Book[] = [
    makeBook({ book_id: 1, name: 'Genesis', testament: 'Old Testament', category: 'Law', chapters_read: 0, num_chapters: 50 }),
    makeBook({ book_id: 2, name: 'Psalms', testament: 'Old Testament', category: 'Poetry', chapters_read: 50, num_chapters: 150 }),
    makeBook({ book_id: 3, name: 'Matthew', testament: 'New Testament', category: 'Gospels', chapters_read: 28, num_chapters: 28 }),
    makeBook({ book_id: 4, name: 'Romans', testament: 'New Testament', category: "Paul's Epistles", chapters_read: 5, num_chapters: 16 }),
  ]

  const noFilter = { search: '', filterTestament: '', filterStatus: '' }

  it('returns all books when no filters applied', () => {
    expect(filterBooks(books, noFilter)).toHaveLength(4)
  })

  it('filters by search (case-insensitive)', () => {
    expect(filterBooks(books, { ...noFilter, search: 'gen' }).map(b => b.name)).toEqual(['Genesis'])
  })

  it('returns nothing when search has no matches', () => {
    expect(filterBooks(books, { ...noFilter, search: 'zzz' })).toHaveLength(0)
  })

  it('filters by testament', () => {
    expect(filterBooks(books, { ...noFilter, filterTestament: 'Old Testament' }).map(b => b.name)).toEqual(['Genesis', 'Psalms'])
  })

  it('filters by status: not_started', () => {
    expect(filterBooks(books, { ...noFilter, filterStatus: 'not_started' }).map(b => b.name)).toEqual(['Genesis'])
  })

  it('filters by status: in_progress', () => {
    // Psalms 50/150, Romans 5/16 — both partially read
    expect(filterBooks(books, { ...noFilter, filterStatus: 'in_progress' }).map(b => b.name)).toEqual(['Psalms', 'Romans'])
  })

  it('filters by status: complete', () => {
    expect(filterBooks(books, { ...noFilter, filterStatus: 'complete' }).map(b => b.name)).toEqual(['Matthew'])
  })

  it('combines search with status filter', () => {
    expect(filterBooks(books, { ...noFilter, search: 'ro', filterStatus: 'in_progress' }).map(b => b.name)).toEqual(['Romans'])
  })
})

describe('splitAlreadyRead', () => {
  it('treats everything as new when the book has no progress', () => {
    expect(splitAlreadyRead([1, 2, 3], [])).toEqual({ newChapters: [1, 2, 3], alreadyRead: [] })
  })

  it('splits a partial overlap into new and already-read', () => {
    expect(splitAlreadyRead([1, 2, 3, 4, 5], [1, 2, 3])).toEqual({
      newChapters: [4, 5],
      alreadyRead: [1, 2, 3],
    })
  })

  it('returns no new chapters when every chapter is already read', () => {
    expect(splitAlreadyRead([1, 2, 3], [1, 2, 3])).toEqual({
      newChapters: [],
      alreadyRead: [1, 2, 3],
    })
  })

  it('handles a non-contiguous overlap', () => {
    expect(splitAlreadyRead([1, 3, 5, 7], [3, 7, 9])).toEqual({
      newChapters: [1, 5],
      alreadyRead: [3, 7],
    })
  })

  it('ignores read chapters absent from the input', () => {
    expect(splitAlreadyRead([10], [1, 2, 3])).toEqual({ newChapters: [10], alreadyRead: [] })
  })

  it('returns two empty lists for empty input', () => {
    expect(splitAlreadyRead([], [1, 2])).toEqual({ newChapters: [], alreadyRead: [] })
  })

  it('preserves the input order in both lists', () => {
    expect(splitAlreadyRead([1, 2, 3, 4], [2, 4])).toEqual({
      newChapters: [1, 3],
      alreadyRead: [2, 4],
    })
  })
})

describe('buildChapterRuns', () => {
  it('collapses an all-unread book into a single run', () => {
    expect(buildChapterRuns(5, [])).toEqual([{ start: 1, end: 5, state: 'unread' }])
  })

  it('splits read from unread without a pending list', () => {
    expect(buildChapterRuns(5, [1, 2])).toEqual([
      { start: 1, end: 2, state: 'read' },
      { start: 3, end: 5, state: 'unread' },
    ])
  })

  it('carves a pending run out of the middle of an unread stretch', () => {
    expect(buildChapterRuns(10, [1, 2], [5, 6, 7])).toEqual([
      { start: 1, end: 2, state: 'read' },
      { start: 3, end: 4, state: 'unread' },
      { start: 5, end: 7, state: 'pending' },
      { start: 8, end: 10, state: 'unread' },
    ])
  })

  it('keeps pending adjacent to read as two distinct runs', () => {
    expect(buildChapterRuns(6, [1, 2], [3, 4])).toEqual([
      { start: 1, end: 2, state: 'read' },
      { start: 3, end: 4, state: 'pending' },
      { start: 5, end: 6, state: 'unread' },
    ])
  })

  it('lets read win over pending so an already-logged chapter stays solid', () => {
    expect(buildChapterRuns(4, [1, 2], [2, 3])).toEqual([
      { start: 1, end: 2, state: 'read' },
      { start: 3, end: 3, state: 'pending' },
      { start: 4, end: 4, state: 'unread' },
    ])
  })

  it('handles pending covering every remaining chapter', () => {
    expect(buildChapterRuns(4, [1], [2, 3, 4])).toEqual([
      { start: 1, end: 1, state: 'read' },
      { start: 2, end: 4, state: 'pending' },
    ])
  })

  it('handles a single-chapter book', () => {
    expect(buildChapterRuns(1, [], [1])).toEqual([{ start: 1, end: 1, state: 'pending' }])
  })

  it('splits logging chapters out of the read run while they animate', () => {
    expect(buildChapterRuns(6, [1, 2, 3, 4], [], [3, 4])).toEqual([
      { start: 1, end: 2, state: 'read' },
      { start: 3, end: 4, state: 'logging' },
      { start: 5, end: 6, state: 'unread' },
    ])
  })

  it('outranks read, pending and unread, so the fill never blinks through another state', () => {
    expect(buildChapterRuns(4, [1], [4], [2, 3])).toEqual([
      { start: 1, end: 1, state: 'read' },
      { start: 2, end: 3, state: 'logging' },
      { start: 4, end: 4, state: 'pending' },
    ])
  })

  it('holds logging on chapters the read list has not caught up to yet', () => {
    expect(buildChapterRuns(4, [1], [], [2, 3])).toEqual([
      { start: 1, end: 1, state: 'read' },
      { start: 2, end: 3, state: 'logging' },
      { start: 4, end: 4, state: 'unread' },
    ])
  })

  it('merges logging back into read once the caller clears it', () => {
    expect(buildChapterRuns(6, [1, 2, 3, 4], [], [])).toEqual([
      { start: 1, end: 4, state: 'read' },
      { start: 5, end: 6, state: 'unread' },
    ])
  })

  it('ignores pending chapters beyond the book length', () => {
    expect(buildChapterRuns(3, [], [2, 99])).toEqual([
      { start: 1, end: 1, state: 'unread' },
      { start: 2, end: 2, state: 'pending' },
      { start: 3, end: 3, state: 'unread' },
    ])
  })
})

describe('formatChapterList', () => {
  it('joins chapters with commas', () => {
    expect(formatChapterList([1, 2, 3])).toBe('1, 2, 3')
  })

  it('returns an empty string for an empty list', () => {
    expect(formatChapterList([])).toBe('')
  })

  it('does not truncate at exactly the limit', () => {
    expect(formatChapterList([1, 2, 3, 4, 5, 6, 7, 8])).toBe('1, 2, 3, 4, 5, 6, 7, 8')
  })

  it('truncates past the limit with an ellipsis', () => {
    expect(formatChapterList([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe('1, 2, 3, 4, 5, 6, 7, 8…')
  })

  it('honours a custom limit', () => {
    expect(formatChapterList([1, 2, 3], 2)).toBe('1, 2…')
  })
})

describe('invalidChaptersMessage', () => {
  it('names the book and its real chapter count', () => {
    expect(invalidChaptersMessage('Romans', 16)).toBe('Romans has 16 chapters — try "1-5" or "3, 7, 12"')
  })
})

describe('defaultBookForCategory', () => {
  const books: Book[] = [
    makeBook({ book_id: 1, name: 'Romans', category: "Paul's Epistles", chapters_read: 16, num_chapters: 16 }),
    makeBook({ book_id: 2, name: '1 Corinthians', category: "Paul's Epistles", chapters_read: 3, num_chapters: 16 }),
    makeBook({ book_id: 3, name: '2 Corinthians', category: "Paul's Epistles", chapters_read: 0, num_chapters: 13 }),
    makeBook({ book_id: 4, name: 'Genesis', category: 'Law', chapters_read: 0, num_chapters: 50 }),
  ]

  it('picks the first book in the category with unread chapters', () => {
    expect(defaultBookForCategory(books, "Paul's Epistles")?.name).toBe('1 Corinthians')
  })

  it('falls back to the first book when the whole category is complete', () => {
    const allRead = books.map(b => b.category === "Paul's Epistles" ? { ...b, chapters_read: b.num_chapters } : b)
    expect(defaultBookForCategory(allRead, "Paul's Epistles")?.name).toBe('Romans')
  })

  it('returns null for a category with no books', () => {
    expect(defaultBookForCategory(books, 'Poetry')).toBeNull()
  })
})
