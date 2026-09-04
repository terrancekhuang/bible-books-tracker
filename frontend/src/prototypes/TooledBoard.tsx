/*
  WORLD · TOOLED BOARD
  THESIS: The whole surface is one object — the front board of a black morocco
  binding — and reading gilds it. Blind tooling is the impression alone; gold
  tooling is the impression with leaf laid in. Those two states are the entire
  design system, so the page needs no other progress device.
  OWN-WORLD: black goatskin with pebble grain, gold leaf and its dim underside,
  a red morocco onlay label on the spine, EB Garamond tooled in caps.
  STORY: how much of the board is gilt, which compartments are still blind,
  lay leaf into the next one.
  FIRST VIEWPORT: the spine at the left with its raised bands and red label, the
  board's triple fillet border, the tooled head, then the lattice of sixty-six
  compartments; the bench is a cartouche at the foot.
*/
import { useMemo, useState } from 'react'
import { BOOKS, CURRENT_STREAK, CYCLE } from './seed'
import { parseChapters, splitAlreadyRead, TOTAL_CHAPTERS, type Book } from '../lib/trackerLogic'

const CATEGORY_ORDER = [
  'Law', 'History', 'Poetry', 'Major Prophets', 'Minor Prophets',
  'Gospels', 'Church History', "Paul's Epistles", 'General Epistles',
]

const GOLD = '#C9962C'
const GOLD_LIT = '#EBCB80'
const BLIND = 'rgba(219,203,171,0.30)'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/* ── One compartment ─────────────────────────────────────────────────────────
   The fillet is run around the compartment with a tool; it gets as far as the
   book has. A closed book is finished with a centre ornament. */
function Compartment({ book, selected, onSelect }: {
  book: Book; selected: boolean; onSelect: () => void
}) {
  const p = book.chapters_read / book.num_chapters
  const done = p >= 1
  const started = p > 0

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      title={`${book.name} — ${book.chapters_read} of ${book.num_chapters}`}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 7,
        width: '100%', height: 78, padding: '12px 12px 10px', overflow: 'hidden',
      }}
    >
      {/* The fillet. Non-scaling stroke, so a compartment stretched by the grid keeps
          one tool weight on all four sides instead of thinning on the verticals. */}
      <svg
        viewBox="0 0 200 78" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <rect x="3" y="3" width="194" height="72" fill="none" vectorEffect="non-scaling-stroke"
              stroke="rgba(0,0,0,0.8)" strokeWidth="2.6" />
        <rect x="3" y="3" width="194" height="72" fill="none" vectorEffect="non-scaling-stroke"
              stroke={BLIND} strokeWidth="1" />
        {started && (
          <rect
            x="3" y="3" width="194" height="72" fill="none" vectorEffect="non-scaling-stroke"
            stroke={selected ? GOLD_LIT : GOLD} strokeWidth="1.5"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}
            style={{ transition: 'stroke-dashoffset 520ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        )}
        {selected && (
          <rect x="0.5" y="0.5" width="199" height="77" fill="none" vectorEffect="non-scaling-stroke"
                stroke={GOLD_LIT} strokeWidth="1" opacity="0.6" />
        )}
      </svg>

      <span
        className={started ? 'tooled' : 'blind'}
        style={{
          position: 'relative', fontSize: 12, lineHeight: 1.16, fontWeight: 500,
          textAlign: 'center', color: selected ? GOLD_LIT : undefined,
        }}
      >
        {book.name}
      </span>

      {/* A closed book is finished with the centre tool; an open one still counts. */}
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ position: 'relative' }}>
          <path d="M12 2c1.6 4.4 3.9 6.7 8.3 8.3-4.4 1.6-6.7 3.9-8.3 8.3-1.6-4.4-3.9-6.7-8.3-8.3C8.1 8.7 10.4 6.4 12 2z" fill={GOLD} />
        </svg>
      ) : (
        <span
          className={started ? 'tooled' : 'blind'}
          style={{ position: 'relative', fontSize: 10, letterSpacing: '0.22em', fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          {book.chapters_read} · {book.num_chapters}
        </span>
      )}
    </button>
  )
}

export default function TooledBoard() {
  const [books, setBooks] = useState<Book[]>(BOOKS)
  const [selectedId, setSelectedId] = useState<number | null>(45)
  const [input, setInput] = useState('12-16')

  const selected = books.find(b => b.book_id === selectedId) ?? null
  const totalRead = useMemo(() => books.reduce((s, b) => s + b.chapters_read, 0), [books])
  const closed = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])
  const pct = Math.round((totalRead / TOTAL_CHAPTERS) * 100)

  const parsed = selected ? parseChapters(input, selected.num_chapters) : []
  const { newChapters } = selected
    ? splitAlreadyRead(parsed, selected.chapters_read_list)
    : { newChapters: [] as number[] }
  const invalid = input.trim().length > 0 && parsed.length === 0

  const tool = () => {
    if (!selected || newChapters.length === 0) return
    setBooks(prev => prev.map(b => {
      if (b.book_id !== selected.book_id) return b
      const list = [...new Set([...b.chapters_read_list, ...newChapters])].sort((a, c) => a - c)
      return { ...b, chapters_read: list.length, chapters_read_list: list }
    }))
    setInput('')
  }

  return (
    <div className="w-tooled" style={{ display: 'flex', minHeight: '100%' }}>

      {/* The spine, seen edge-on at the left of the board. */}
      <aside
        style={{
          flex: '0 0 clamp(56px, 8vw, 96px)', position: 'relative',
          background: 'linear-gradient(90deg, #050403, #221D17 26%, #17130F 62%, #000 100%)',
          boxShadow: 'inset -14px 0 22px -14px rgba(0,0,0,0.95)',
        }}
      >
        {[0.13, 0.35, 0.57, 0.79].map(t => (
          <span
            key={t}
            aria-hidden
            style={{
              position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 13,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(0,0,0,0.72))',
              boxShadow: '0 -1px 0 rgba(0,0,0,0.8), 0 1px 0 rgba(255,231,170,0.10)',
            }}
          />
        ))}
        {/* The onlay: a panel of red morocco let into the black, titled in gold. */}
        <div
          style={{
            position: 'absolute', left: 8, right: 8, top: '17%', padding: '16px 4px',
            background: 'linear-gradient(180deg, #8E2024, var(--onlay) 45%, #5E1013)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), 0 2px 6px -2px rgba(0,0,0,0.8)',
            writingMode: 'vertical-rl', textAlign: 'center',
          }}
        >
          <h1 className="tooled" style={{ margin: 0, fontSize: 'clamp(11px, 1.5vw, 15px)', letterSpacing: '0.26em', fontWeight: 500, color: GOLD_LIT }}>
            Bible Books Tracker
          </h1>
        </div>
        <p
          className="tooled"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 22, margin: 0,
            writingMode: 'vertical-rl', textAlign: 'center',
            fontSize: 11, letterSpacing: '0.3em',
          }}
        >
          Vol. {ROMAN[CYCLE]}
        </p>
      </aside>

      {/* The board. */}
      <main style={{ flex: 1, minWidth: 0, padding: 'clamp(20px, 3vw, 40px)' }}>
        <div
          style={{
            padding: 'clamp(26px, 3.4vw, 48px) clamp(20px, 3vw, 44px) clamp(24px, 3vw, 40px)',
            /* A triple fillet: gold, impression, gold, impression, gold. */
            boxShadow: [
              `0 0 0 1px ${GOLD}`,
              '0 0 0 2px rgba(0,0,0,0.85)',
              `0 0 0 3px ${GOLD}`,
              '0 0 0 9px rgba(0,0,0,0.55)',
              `0 0 0 10px ${GOLD}`,
            ].join(', '),
          }}
        >
          {/* Head of the board. */}
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <p className="tooled" style={{ margin: 0, fontSize: 'clamp(15px, 2.2vw, 24px)', letterSpacing: '0.30em', fontWeight: 500, color: GOLD_LIT }}>
              Sixty-six books
            </p>
            <div aria-hidden style={{ height: 1, margin: '16px auto', width: 'min(360px, 60%)', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
            <p className="tooled" style={{ margin: 0, fontSize: 'clamp(10px, 1.3vw, 12px)', letterSpacing: '0.24em', opacity: 0.9 }}>
              {totalRead.toLocaleString()} of {TOTAL_CHAPTERS.toLocaleString()} chapters gilt · {pct}% · {closed} compartments closed · {CURRENT_STREAK} days
            </p>
          </div>

          {/* The lattice. */}
          {CATEGORY_ORDER.map(cat => {
            const inCat = books.filter(b => b.category === cat)
            if (!inCat.length) return null
            return (
              <section key={cat} style={{ marginBottom: 30 }}>
                <h2
                  className="tooled"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 12px',
                    fontSize: 10, letterSpacing: '0.34em', fontWeight: 500, opacity: 0.85,
                  }}
                >
                  {cat}
                  <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${GOLD}55, transparent)` }} />
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(142px, 1fr))', gap: 11 }}>
                  {inCat.map(b => (
                    <Compartment
                      key={b.book_id}
                      book={b}
                      selected={b.book_id === selectedId}
                      onSelect={() => { setSelectedId(b.book_id); setInput('') }}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {/* The cartouche at the foot: where the next leaf is laid. */}
          <section
            aria-label="Lay gold"
            style={{
              marginTop: 40, padding: '24px 26px',
              display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 30px',
              boxShadow: `0 0 0 1px ${GOLD}, 0 0 0 2px rgba(0,0,0,0.8), 0 0 0 4px ${GOLD}55`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.030), transparent)',
            }}
          >
            <div style={{ flex: '0 1 300px', minWidth: 0 }}>
              <h2 className="tooled" style={{ margin: 0, fontSize: 27, letterSpacing: '0.12em', fontWeight: 500, color: GOLD_LIT }}>
                {selected ? selected.name : 'Choose a compartment'}
              </h2>
              {selected && (
                <p className="tooled" style={{ margin: '9px 0 0', fontSize: 11, letterSpacing: '0.18em', opacity: 0.85 }}>
                  {selected.chapters_read} of {selected.num_chapters} gilt · {selected.category}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <label>
                <span className="tooled" style={{ display: 'block', fontSize: 9, letterSpacing: '0.28em', marginBottom: 8, opacity: 0.8 }}>
                  Chapters
                </span>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') tool() }}
                  placeholder="1-4, 9"
                  disabled={!selected}
                  style={{
                    width: 146, padding: '10px 13px', fontSize: 16,
                    fontFamily: "'EB Garamond', serif", letterSpacing: '0.06em',
                    background: 'rgba(0,0,0,0.55)', color: GOLD_LIT,
                    border: `1px solid ${invalid ? '#C4574A' : `${GOLD}77`}`,
                    borderRadius: 0, outline: 'none',
                  }}
                />
              </label>
              <button
                onClick={tool}
                disabled={newChapters.length === 0}
                className="tooled"
                style={{
                  padding: '11px 26px', fontSize: 11, letterSpacing: '0.26em', fontWeight: 500,
                  background: newChapters.length ? `linear-gradient(180deg, ${GOLD_LIT}, ${GOLD} 55%, #8A6414)` : 'transparent',
                  color: newChapters.length ? '#231404' : 'rgba(219,203,171,0.42)',
                  textShadow: 'none',
                  boxShadow: newChapters.length ? '0 2px 0 rgba(0,0,0,0.7)' : `inset 0 0 0 1px ${GOLD}44`,
                  cursor: newChapters.length ? 'pointer' : 'not-allowed',
                }}
              >
                Lay gold
              </button>
            </div>

            <p className="tooled" style={{ flexBasis: '100%', margin: 0, fontSize: 11, letterSpacing: '0.12em', color: invalid ? '#E29A8E' : undefined, opacity: invalid ? 1 : 0.72 }}>
              {invalid
                ? `${selected?.name ?? 'This book'} runs to ${selected?.num_chapters ?? 0} chapters — that range falls outside it.`
                : newChapters.length > 0
                  ? `${newChapters.length} chapter${newChapters.length === 1 ? '' : 's'} to gild.`
                  : 'Chapters already gilt take no more leaf.'}
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
