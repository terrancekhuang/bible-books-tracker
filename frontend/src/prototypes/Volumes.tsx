/*
  WORLD · VOLUMES
  THESIS: Not one book but a nine-volume set in publisher's cloth, one volume per
  category, each as thick as the chapters it holds. Pull a volume and it opens to
  its contents leaf. Refuses the single-surface framing of Fore-Edge: the structure
  here is a set you drill into, and colour does the work leather did.
  OWN-WORLD: nine saturated cloth colours on a dark shelf, blind-stamped panels,
  gilt spine labels and gilt head edges, Bevan slab lettering outside and a ruled
  laid-paper leaf with red rules inside.
  STORY: which volume is furthest along, what is left inside it, log the next chapters.
  FIRST VIEWPORT: the nine volumes standing at the head of the page, thickness
  telling you their size and gilt head edges telling you their progress; the chosen
  volume's contents leaf opens beneath.
*/
import { useMemo, useState } from 'react'
import { BOOKS, CURRENT_STREAK, CYCLE, READER } from './seed'
import { parseChapters, splitAlreadyRead, TOTAL_CHAPTERS, type Book } from '../lib/trackerLogic'

const CATEGORY_ORDER = [
  'Law', 'History', 'Poetry', 'Major Prophets', 'Minor Prophets',
  'Gospels', 'Church History', "Paul's Epistles", 'General Epistles',
]

/** Publisher's cloth, the bright end of the range rather than the library end. */
const CLOTH: Record<string, string> = {
  'Law': '#0E7245',
  'History': '#9E1B2F',
  'Poetry': '#0F6E78',
  'Major Prophets': '#1B4B9E',
  'Minor Prophets': '#6B2A57',
  'Gospels': '#B8840F',
  'Church History': '#B04A24',
  "Paul's Epistles": '#3C5A70',
  'General Epistles': '#5E6B1E',
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const GILT = '#D2A63F'
const PAPER_EDGE = '#EAE5D6'

interface Vol { cat: string; books: Book[]; read: number; total: number; pct: number }

function Spine({ vol, index, selected, onSelect }: {
  vol: Vol; index: number; selected: boolean; onSelect: () => void
}) {
  const cloth = CLOTH[vol.cat]
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      title={`Volume ${ROMAN[index + 1]} — ${vol.cat}, ${vol.read} of ${vol.total} chapters`}
      style={{
        position: 'relative', flex: `${vol.total} 1 0`, minWidth: 58, height: 300,
        alignSelf: 'flex-end',
        transform: selected ? 'translateY(-22px)' : 'none',
        transition: 'transform 260ms cubic-bezier(0.16,1,0.3,1), filter 200ms ease',
        filter: selected ? 'none' : 'brightness(0.86)',
      }}
    >
      {/* The head edge: gilt as far as the volume has been read, raw paper after. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 2, right: 2, top: -6, height: 7,
          background: `linear-gradient(90deg, ${GILT} 0 ${vol.pct}%, ${PAPER_EDGE} ${vol.pct}% 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.6)',
        }}
      />
      {/* The cloth. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, rgba(0,0,0,0.55), ${cloth} 20%, ${cloth} 68%, rgba(255,255,255,0.16) 96%, rgba(0,0,0,0.4))`,
          boxShadow: selected
            ? `0 20px 30px -14px rgba(0,0,0,0.9), inset 0 0 0 1px ${GILT}88`
            : '0 14px 22px -14px rgba(0,0,0,0.9)',
        }}
      />
      {/* Raised bands across the spine. */}
      {[0.1, 0.9].map(t => (
        <span
          key={t}
          aria-hidden
          style={{
            position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 9,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(0,0,0,0.45))',
          }}
        />
      ))}
      {/* Blind-stamped rule panel. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 7, right: 7, top: '16%', bottom: '16%',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.42), inset 0 0 0 2px rgba(255,255,255,0.10)',
        }}
      />
      {/* The gilt label. */}
      <span
        className="slab"
        style={{
          position: 'absolute', left: 0, right: 0, top: '22%', bottom: '26%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: 'clamp(10px, 1.05vw, 14px)', letterSpacing: '0.02em',
          color: GILT, textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,236,180,0.28)',
          whiteSpace: 'nowrap', overflow: 'hidden', padding: '4px 0',
        }}
      >
        {vol.cat}
      </span>
      <span
        className="vol-num"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: '5.5%',
          textAlign: 'center', fontSize: 11, letterSpacing: '0.1em',
          color: GILT, fontFamily: 'Archivo, sans-serif', fontWeight: 600,
        }}
      >
        {ROMAN[index + 1]}
      </span>
    </button>
  )
}

export default function Volumes() {
  const [books, setBooks] = useState<Book[]>(BOOKS)
  const [openCat, setOpenCat] = useState("Paul's Epistles")
  const [selectedId, setSelectedId] = useState<number | null>(45)
  const [input, setInput] = useState('12-16')

  const vols: Vol[] = useMemo(() => CATEGORY_ORDER.map(cat => {
    const inCat = books.filter(b => b.category === cat)
    const read = inCat.reduce((s, b) => s + b.chapters_read, 0)
    const total = inCat.reduce((s, b) => s + b.num_chapters, 0)
    return { cat, books: inCat, read, total, pct: total ? Math.round((read / total) * 100) : 0 }
  }), [books])

  const open = vols.find(v => v.cat === openCat) ?? vols[0]
  const openIndex = vols.indexOf(open)
  const selected = books.find(b => b.book_id === selectedId) ?? null
  const totalRead = useMemo(() => books.reduce((s, b) => s + b.chapters_read, 0), [books])
  const closed = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])

  const parsed = selected ? parseChapters(input, selected.num_chapters) : []
  const { newChapters } = selected
    ? splitAlreadyRead(parsed, selected.chapters_read_list)
    : { newChapters: [] as number[] }
  const invalid = input.trim().length > 0 && parsed.length === 0

  const log = () => {
    if (!selected || newChapters.length === 0) return
    setBooks(prev => prev.map(b => {
      if (b.book_id !== selected.book_id) return b
      const list = [...new Set([...b.chapters_read_list, ...newChapters])].sort((a, c) => a - c)
      return { ...b, chapters_read: list.length, chapters_read_list: list }
    }))
    setInput('')
  }

  const cloth = CLOTH[open.cat]

  return (
    <div className="w-vol">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 30px 80px' }}>

        <header
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 18, paddingBottom: 20, marginBottom: 34, borderBottom: `1px solid ${GILT}44`,
          }}
        >
          <h1 className="slab" style={{ margin: 0, fontSize: 'clamp(17px, 2.4vw, 25px)', color: GILT }}>
            Bible Books Tracker
          </h1>
          <p
            className="vol-num"
            style={{ margin: 0, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,236,221,0.7)' }}
          >
            {READER} · set {ROMAN[CYCLE]} · {totalRead.toLocaleString()} of {TOTAL_CHAPTERS.toLocaleString()} · {closed} of 66 closed · {CURRENT_STREAK}d
          </p>
        </header>

        {/* The set. Thickness is how many chapters a volume holds; the gilt head
            edge is how far into it you have read. */}
        <section aria-label="The set" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, paddingTop: 30 }}>
            {vols.map((v, i) => (
              <Spine
                key={v.cat}
                vol={v}
                index={i}
                selected={v.cat === open.cat}
                onSelect={() => {
                  setOpenCat(v.cat)
                  setSelectedId(v.books.find(b => b.chapters_read < b.num_chapters)?.book_id ?? v.books[0].book_id)
                  setInput('')
                }}
              />
            ))}
          </div>
          {/* The shelf the set stands on. */}
          <div
            aria-hidden
            style={{
              height: 13, borderRadius: '0 0 2px 2px',
              background: 'linear-gradient(180deg, var(--shelf-lit), #241C15 70%, #100C09)',
              boxShadow: '0 12px 22px -12px rgba(0,0,0,0.95)',
            }}
          />
        </section>

        {/* The contents leaf of the open volume. */}
        <section
          aria-label={`Contents of volume ${ROMAN[openIndex + 1]}`}
          style={{
            marginTop: 44, padding: 'clamp(24px, 3.4vw, 46px)',
            backgroundColor: 'var(--leaf)',
            backgroundImage: [
              'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px)',
              'linear-gradient(178deg, #F6F1E4, #F2ECDD 40%, #E6DECA)',
            ].join(', '),
            color: 'var(--ink)',
            boxShadow: `0 24px 44px -22px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(35,31,26,0.14)`,
            borderTop: `6px solid ${cloth}`,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <p
              className="vol-num"
              style={{ margin: 0, fontSize: 10, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.6)' }}
            >
              Volume {ROMAN[openIndex + 1]}
            </p>
            <h2 className="slab" style={{ margin: '10px 0 0', fontSize: 'clamp(24px, 3.6vw, 40px)', color: 'var(--ink)' }}>
              {open.cat}
            </h2>
            <div aria-hidden style={{ margin: '18px auto 0', width: 'min(320px, 55%)' }}>
              <div style={{ height: 2, background: 'var(--leaf-red)' }} />
              <div style={{ height: 1, marginTop: 3, background: 'var(--leaf-red)' }} />
            </div>
            <p
              className="vol-num"
              style={{ margin: '16px 0 0', fontSize: 12, letterSpacing: '0.14em', color: 'rgba(35,31,26,0.72)' }}
            >
              {open.books.length} books · {open.read} of {open.total} chapters · {open.pct}%
            </p>
          </div>

          {/* The table of contents, ruled and leadered. */}
          <ol style={{ listStyle: 'none', margin: '0 auto', padding: 0, maxWidth: 720 }}>
            {open.books.map(b => {
              const p = b.chapters_read / b.num_chapters
              const active = b.book_id === selectedId
              return (
                <li key={b.book_id}>
                  <button
                    onClick={() => { setSelectedId(b.book_id); setInput('') }}
                    aria-pressed={active}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 10px 7px',
                      background: active ? 'rgba(35,31,26,0.065)' : 'transparent',
                      transition: 'background-color 140ms ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span
                        className="vol-num"
                        style={{ fontSize: 17, fontWeight: active ? 700 : 500, color: p >= 1 ? 'rgba(35,31,26,0.55)' : 'var(--ink)' }}
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
                    {/* The rule under each entry is the volume's own cloth colour. */}
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

          {/* The entry line at the foot of the leaf. */}
          <div
            style={{
              maxWidth: 720, margin: '34px auto 0', paddingTop: 22,
              borderTop: '1px solid rgba(35,31,26,0.2)',
              display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '14px 18px',
            }}
          >
            <span className="slab" style={{ fontSize: 22, color: 'var(--ink)' }}>
              {selected ? selected.name : 'Choose an entry'}
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              <span className="vol-num" style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.62)' }}>
                Chapters
              </span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') log() }}
                placeholder="1-4, 9"
                disabled={!selected}
                className="vol-num"
                style={{
                  width: 132, padding: '4px 2px', fontSize: 16, fontFamily: 'Archivo, sans-serif',
                  background: 'transparent', color: 'var(--ink)',
                  border: 0, borderBottom: `2px solid ${invalid ? 'var(--leaf-red)' : cloth}`,
                  borderRadius: 0, outline: 'none',
                }}
              />
            </label>
            <button
              onClick={log}
              disabled={newChapters.length === 0}
              className="vol-num"
              style={{
                padding: '9px 22px', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
                fontFamily: 'Archivo, sans-serif', fontWeight: 600,
                background: newChapters.length ? cloth : 'transparent',
                color: newChapters.length ? 'var(--leaf)' : 'rgba(35,31,26,0.42)',
                boxShadow: newChapters.length ? '0 2px 0 rgba(0,0,0,0.35)' : 'inset 0 0 0 1px rgba(35,31,26,0.28)',
                cursor: newChapters.length ? 'pointer' : 'not-allowed',
              }}
            >
              Enter
            </button>
            <span
              className="vol-num"
              style={{ fontSize: 12, color: invalid ? 'var(--leaf-red)' : 'rgba(35,31,26,0.62)' }}
            >
              {invalid
                ? `${selected?.name ?? 'This book'} has ${selected?.num_chapters ?? 0} chapters.`
                : newChapters.length > 0
                  ? `${newChapters.length} to enter`
                  : 'ranges and lists both read'}
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
