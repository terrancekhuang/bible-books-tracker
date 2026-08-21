import { describe, it, expect } from 'vitest'
import {
  parseChapters,
  splitAlreadyRead,
  formatChapterList,
  calculateProgress,
  sortBooks,
  filterBooks,
  availableFilterOptions,
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

describe('sortBooks', () => {
  const books: Book[] = [
    makeBook({ book_id: 1, name: 'Genesis', chapters_read: 5, num_chapters: 50 }),
    makeBook({ book_id: 2, name: 'Revelation', chapters_read: 22, num_chapters: 22 }),
    makeBook({ book_id: 3, name: 'Psalms', chapters_read: 0, num_chapters: 150 }),
  ]

  it('returns the same order when sortKey is null', () => {
    const result = sortBooks(books, null, 'asc')
    expect(result.map(b => b.name)).toEqual(['Genesis', 'Revelation', 'Psalms'])
  })

  it('does not mutate the original array', () => {
    const original = books.map(b => b.name)
    sortBooks(books, 'name', 'asc')
    expect(books.map(b => b.name)).toEqual(original)
  })

  it('sorts by name ascending', () => {
    expect(sortBooks(books, 'name', 'asc').map(b => b.name)).toEqual(['Genesis', 'Psalms', 'Revelation'])
  })

  it('sorts by name descending', () => {
    expect(sortBooks(books, 'name', 'desc').map(b => b.name)).toEqual(['Revelation', 'Psalms', 'Genesis'])
  })

  it('sorts by chapters_read ascending', () => {
    expect(sortBooks(books, 'chapters_read', 'asc').map(b => b.chapters_read)).toEqual([0, 5, 22])
  })

  it('sorts by chapters_read descending', () => {
    expect(sortBooks(books, 'chapters_read', 'desc').map(b => b.chapters_read)).toEqual([22, 5, 0])
  })

  it('sorts by percent ascending', () => {
    // Genesis: 5/50=10%, Revelation: 22/22=100%, Psalms: 0/150=0%
    expect(sortBooks(books, 'percent', 'asc').map(b => b.name)).toEqual(['Psalms', 'Genesis', 'Revelation'])
  })

  it('sorts by status ascending (not_started < in_progress < complete)', () => {
    // Psalms: 0 (not started), Genesis: 1 (in progress), Revelation: 2 (complete)
    expect(sortBooks(books, 'status', 'asc').map(b => b.name)).toEqual(['Psalms', 'Genesis', 'Revelation'])
  })

  it('sorts by status descending (complete first)', () => {
    expect(sortBooks(books, 'status', 'desc').map(b => b.name)).toEqual(['Revelation', 'Genesis', 'Psalms'])
  })
})

describe('filterBooks', () => {
  const books: Book[] = [
    makeBook({ book_id: 1, name: 'Genesis', testament: 'Old Testament', category: 'Law', chapters_read: 0, num_chapters: 50 }),
    makeBook({ book_id: 2, name: 'Psalms', testament: 'Old Testament', category: 'Poetry', chapters_read: 50, num_chapters: 150 }),
    makeBook({ book_id: 3, name: 'Matthew', testament: 'New Testament', category: 'Gospels', chapters_read: 28, num_chapters: 28 }),
    makeBook({ book_id: 4, name: 'Romans', testament: 'New Testament', category: "Paul's Epistles", chapters_read: 5, num_chapters: 16 }),
  ]

  const noFilter = { search: '', filterTestament: '', filterCategory: '', filterStatus: '' }

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

  it('filters by category', () => {
    expect(filterBooks(books, { ...noFilter, filterCategory: 'Gospels' }).map(b => b.name)).toEqual(['Matthew'])
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

  it('combines testament and category filters', () => {
    expect(filterBooks(books, { ...noFilter, filterTestament: 'New Testament', filterCategory: "Paul's Epistles" }).map(b => b.name)).toEqual(['Romans'])
  })

  it('combines search with status filter', () => {
    expect(filterBooks(books, { ...noFilter, search: 'ro', filterStatus: 'in_progress' }).map(b => b.name)).toEqual(['Romans'])
  })
})

describe('availableFilterOptions', () => {
  const books: Book[] = [
    makeBook({ book_id: 1, name: 'Genesis', testament: 'Old Testament', category: 'Law' }),
    makeBook({ book_id: 2, name: 'Psalms', testament: 'Old Testament', category: 'Poetry' }),
    makeBook({ book_id: 3, name: 'Matthew', testament: 'New Testament', category: 'Gospels' }),
    makeBook({ book_id: 4, name: 'Romans', testament: 'New Testament', category: "Paul's Epistles" }),
  ]

  it('returns all testaments and categories when no filters active', () => {
    const opts = availableFilterOptions(books, { filterTestament: '', filterCategory: '' })
    expect(opts.testaments.sort()).toEqual(['New Testament', 'Old Testament'])
    expect(opts.categories.sort()).toEqual(['Gospels', 'Law', "Paul's Epistles", 'Poetry'])
  })

  it('limits categories to those within the active testament', () => {
    const opts = availableFilterOptions(books, { filterTestament: 'Old Testament', filterCategory: '' })
    expect(opts.categories.sort()).toEqual(['Law', 'Poetry'])
    // testaments are not filtered by the active testament filter
    expect(opts.testaments.sort()).toEqual(['New Testament', 'Old Testament'])
  })

  it('limits testaments to those within the active category', () => {
    const opts = availableFilterOptions(books, { filterTestament: '', filterCategory: 'Gospels' })
    expect(opts.testaments.sort()).toEqual(['New Testament'])
    // categories are not filtered by the active category filter
    expect(opts.categories.sort()).toEqual(['Gospels', 'Law', "Paul's Epistles", 'Poetry'])
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
