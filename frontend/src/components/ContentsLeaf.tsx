import { CLOTH, GILT } from '../lib/volumesTokens'
import type { Book } from '../lib/trackerLogic'

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
}

export default function ContentsLeaf({
  heading, romanNumeral, topBorder, books, selectedBookName, onSelectBook, summary,
}: ContentsLeafProps) {
  return (
    <section
      aria-label={`Contents of ${heading}`}
      style={{
        marginTop: 32, padding: 'clamp(20px, 3.4vw, 46px)',
        backgroundColor: 'var(--color-leaf)',
        backgroundImage: [
          'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px)',
          'linear-gradient(178deg, #F6F1E4, #F2ECDD 40%, #E6DECA)',
        ].join(', '),
        color: 'var(--color-ink)',
        boxShadow: '0 24px 44px -22px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(35,31,26,0.14)',
        borderTop: `6px solid ${topBorder}`,
        borderRadius: '0 0 0.5rem 0.5rem',
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
            return (
              <li key={b.book_id}>
                <button
                  onClick={() => onSelectBook(b.name)}
                  aria-pressed={active}
                  data-book={b.name}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 10px 7px',
                    background: active ? 'rgba(35,31,26,0.065)' : 'transparent',
                    transition: 'background-color 140ms ease',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span
                      className="vol-num"
                      style={{ fontSize: 17, fontWeight: active ? 700 : 500, color: p >= 1 ? 'rgba(35,31,26,0.55)' : 'var(--color-ink)' }}
                    >
                      {b.name}
                    </span>
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
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
