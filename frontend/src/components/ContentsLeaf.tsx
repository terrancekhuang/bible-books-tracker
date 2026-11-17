import type { ReactNode } from 'react'
import { CLOTH, GILT } from '../lib/volumesTokens'
import { leafSurfaceStyle } from '../lib/leafSurface'
import { nextChapter, type Book } from '../lib/trackerLogic'
import MarkReadButton from './MarkReadButton'

interface ContentsLeafProps {
  /** The category name (open-volume mode) or a summary heading (flattened mode). */
  heading: string
  /** Roman numeral shown above the heading — null in flattened mode, where there's no single volume. */
  romanNumeral: string | null
  /** The leaf's top-border colour — the open volume's cloth, or a neutral ink tone when flattened. */
  topBorder: string
  /** Rows to list, already in the order they should render. */
  books: Book[]
  selectedBookName: string | null
  onSelectBook: (name: string) => void
  /** Shown under the heading — book/chapter counts, or a "no matches" message when `books` is empty. */
  summary: string
  /** The entry line, opened directly under the selected book's row. */
  entry: ReactNode
  /** Logs a book's next chapter from its row's checkmark — see useMarkNext. */
  onMark: (book: Book) => void
  /** Books with a mark in flight; their checkmark is disabled. */
  markingBooks: string[]
  /** The book whose last mark failed to save, if any. */
  markError: string | null
}

export default function ContentsLeaf({
  heading, romanNumeral, topBorder, books, selectedBookName, onSelectBook, summary, entry,
  onMark, markingBooks, markError,
}: ContentsLeafProps) {
  return (
    <section
      aria-label={`Contents of ${heading}`}
      style={{
        marginTop: 32, padding: 'clamp(20px, 3.4vw, 46px)',
        ...leafSurfaceStyle(topBorder),
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        {romanNumeral && (
          <p
            className="vol-num"
            style={{ margin: 0, fontSize: 10, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.6)' }}
          >
            Volume {romanNumeral}
          </p>
        )}
        <h2 className="slab" style={{ margin: romanNumeral ? '10px 0 0' : 0, fontSize: 'clamp(22px, 3.6vw, 36px)', color: 'var(--color-ink)' }}>
          {heading}
        </h2>
        <div aria-hidden style={{ margin: '16px auto 0', width: 'min(320px, 55%)' }}>
          <div style={{ height: 2, background: 'var(--color-leaf-red)' }} />
          <div style={{ height: 1, marginTop: 3, background: 'var(--color-leaf-red)' }} />
        </div>
        <p
          className="vol-num"
          style={{ margin: '14px 0 0', fontSize: 12, letterSpacing: '0.14em', color: 'rgba(35,31,26,0.72)' }}
        >
          {summary}
        </p>
      </div>

      {books.length > 0 && (
        <ol style={{ listStyle: 'none', margin: '0 auto', padding: 0, maxWidth: 720 }}>
          {books.map(b => {
            const p = b.num_chapters ? b.chapters_read / b.num_chapters : 0
            const active = b.name === selectedBookName
            const cloth = CLOTH[b.category]
            const next = nextChapter(b)
            return (
              <li key={b.book_id}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: active ? 'rgba(35,31,26,0.065)' : 'transparent',
                    transition: 'background-color 140ms ease',
                  }}
                >
                <button
                  onClick={() => onSelectBook(b.name)}
                  aria-pressed={active}
                  data-book={b.name}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 10px 7px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span
                      className="vol-num"
                      style={{ fontSize: 17, fontWeight: active ? 700 : 500, color: p >= 1 ? 'rgba(35,31,26,0.55)' : 'var(--color-ink)' }}
                    >
                      {b.name}
                    </span>
                    {next !== null && (
                      <span className="vol-num" style={{ fontSize: 14, color: 'rgba(35,31,26,0.6)', whiteSpace: 'nowrap' }}>
                        Ch. {next}
                      </span>
                    )}
                    <span
                      aria-hidden
                      style={{
                        flex: 1, height: '1em', minWidth: 24,
                        backgroundImage: 'radial-gradient(circle at 50% 90%, rgba(35,31,26,0.42) 0 1px, transparent 1.2px)',
                        backgroundSize: '6px 100%',
                      }}
                    />
                    <span className="vol-num" style={{ fontSize: 14, color: 'rgba(35,31,26,0.78)', whiteSpace: 'nowrap' }}>
                      {b.chapters_read} / {b.num_chapters}
                    </span>
                  </span>
                  {/* The rule under each entry is that book's own volume's cloth colour. */}
                  <span aria-hidden style={{ display: 'block', height: 3, marginTop: 6, background: 'rgba(35,31,26,0.13)' }}>
                    <span
                      style={{
                        display: 'block', height: '100%', width: '100%',
                        transform: `scaleX(${p})`, transformOrigin: 'left',
                        background: p >= 1 ? GILT : cloth,
                        transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1)',
                      }}
                    />
                  </span>
                </button>
                {/* Outside the row button so a mark never selects the book, and kept-selection so
                    marking another row doesn't fold the open entry line away. Finished books keep
                    an empty slot, so every row's count lines up. */}
                <span data-keep-selection style={{ width: 32, flexShrink: 0 }}>
                  {next !== null && (
                    <MarkReadButton
                      bookName={b.name}
                      chapter={next}
                      disabled={markingBooks.includes(b.name)}
                      onMark={() => onMark(b)}
                    />
                  )}
                </span>
                </div>
                {markError === b.name && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-leaf-red)', paddingLeft: 10 }} role="alert">
                    Couldn't save — please try again.
                  </p>
                )}
                {active && entry}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
