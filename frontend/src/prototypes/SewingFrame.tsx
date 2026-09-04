/*
  WORLD · SEWING FRAME
  THESIS: The Bible before it is a book. Sixty-six folded quires laid across linen
  tapes, sewn one chapter-station at a time. Refuses the finished-object framing of
  Fore-Edge: nothing here is gilded, because nothing here is bound yet.
  OWN-WORLD: millboard ground, bone quires, natural linen tape, walnut uprights,
  one madder-red waxed thread, Archivo Narrow workshop lettering.
  STORY: how much is sewn, what is still pricked-but-unsewn, sew the next stations.
  FIRST VIEWPORT: the docket, the frame's total, the bench, then the frame itself —
  sixty-six folds descending in canon order with three tapes crossing them all.
*/
import { useMemo, useState } from 'react'
import { BOOKS, ACTIVITY, CURRENT_STREAK, CYCLE, READER } from './seed'
import { parseChapters, splitAlreadyRead, TOTAL_CHAPTERS, type Book } from '../lib/trackerLogic'

/** Psalms is the longest gathering; every fold is measured against it. */
const LONGEST = 150
/** Where the tapes cross the frame, as a fraction of the widest fold. */
const TAPES = [0.2, 0.46, 0.72]

const MADDER = '#A8322A'
const BONE = '#EFE8D6'

function Fold({ book, selected, onSelect, sewing }: {
  book: Book; selected: boolean; onSelect: () => void; sewing: boolean
}) {
  const n = book.num_chapters
  const p = book.chapters_read / n
  const width = `${(n / LONGEST) * 100}%`

  return (
    <>
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className="docket"
        style={{
          gridColumn: 1, textAlign: 'right', paddingRight: 14,
          fontSize: 10.5, letterSpacing: '0.1em', lineHeight: '15px',
          color: selected ? MADDER : 'var(--ink)',
          fontWeight: selected ? 700 : book.chapters_read ? 600 : 400,
        }}
      >
        {book.name}
      </button>

      <div style={{ gridColumn: 2, position: 'relative', height: 15, display: 'flex', alignItems: 'center' }}>
        {/* The fold itself: a bone spine-edge the width of this gathering. */}
        <div
          onClick={onSelect}
          style={{
            position: 'relative', width, height: 11, cursor: 'pointer',
            background: `linear-gradient(180deg, ${BONE} 0%, #DCD3BC 55%, #C4B99E 100%)`,
            boxShadow: selected
              ? `0 0 0 1.5px ${MADDER}, 0 3px 5px -2px rgba(0,0,0,0.4)`
              : '0 2px 3px -2px rgba(0,0,0,0.45)',
            borderRadius: '1px',
          }}
        >
          {/* Pricking: one hole per chapter, whether it is sewn yet or not. */}
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle at 50% 50%, var(--prick) 0 1.05px, transparent 1.2px)',
              backgroundSize: `calc(100% / ${n}) 100%`,
              opacity: 0.75,
            }}
          />
          {/* The running stitch, as far as it has been taken. */}
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
              backgroundImage: `linear-gradient(90deg, ${MADDER} 0 62%, transparent 62%)`,
              backgroundSize: `calc(100% / ${n}) 100%`,
              backgroundPosition: 'center',
              filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.35))',
              animation: sewing ? 'sew 560ms cubic-bezier(0.16,1,0.3,1) both' : undefined,
              transition: 'clip-path 420ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
          {/* Kettle stitches: the knots that link this quire to the one before it. */}
          {book.chapters_read > 0 && (
            <>
              <span aria-hidden style={knot(0)} />
              {p >= 1 && <span aria-hidden style={knot(1)} />}
            </>
          )}
        </div>

        <span
          className="docket"
          style={{
            marginLeft: 15, fontSize: 9.5, letterSpacing: '0.08em', fontWeight: 600,
            color: p >= 1 ? MADDER : 'rgba(26,25,21,0.82)',
            whiteSpace: 'nowrap',
          }}
        >
          {book.chapters_read}/{n}
        </span>
      </div>
    </>
  )
}

const knot = (end: 0 | 1): React.CSSProperties => ({
  position: 'absolute', top: '50%', [end ? 'right' : 'left']: -3,
  width: 6, height: 6, marginTop: -3, borderRadius: '50%',
  background: MADDER, boxShadow: '0 1px 1px rgba(0,0,0,0.5)',
})

export default function SewingFrame() {
  const [books, setBooks] = useState<Book[]>(BOOKS)
  const [selectedId, setSelectedId] = useState<number | null>(45)
  const [input, setInput] = useState('12-16')
  const [sewingId, setSewingId] = useState<number | null>(null)

  const selected = books.find(b => b.book_id === selectedId) ?? null
  const totalRead = useMemo(() => books.reduce((s, b) => s + b.chapters_read, 0), [books])
  const closed = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])

  const parsed = selected ? parseChapters(input, selected.num_chapters) : []
  const { newChapters } = selected
    ? splitAlreadyRead(parsed, selected.chapters_read_list)
    : { newChapters: [] as number[] }
  const invalid = input.trim().length > 0 && parsed.length === 0

  const sew = () => {
    if (!selected || newChapters.length === 0) return
    setSewingId(selected.book_id)
    setBooks(prev => prev.map(b => {
      if (b.book_id !== selected.book_id) return b
      const list = [...new Set([...b.chapters_read_list, ...newChapters])].sort((a, c) => a - c)
      return { ...b, chapters_read: list.length, chapters_read_list: list }
    }))
    setInput('')
    window.setTimeout(() => setSewingId(null), 620)
  }

  const year = useMemo(() => {
    const map = new Map(ACTIVITY.map(a => [a.logged_at, a.chapters]))
    const out: number[] = []
    const d = new Date('2026-09-04T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 364)
    for (let i = 0; i < 365; i++) {
      out.push(map.get(d.toISOString().slice(0, 10)) ?? 0)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return out
  }, [])

  return (
    <div className="w-frame">
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '30px 34px 80px' }}>

        {/* The docket taped to the bench. */}
        <header style={{ position: 'relative', marginBottom: 34 }}>
          <div
            style={{
              display: 'inline-block', padding: '13px 26px',
              background: `linear-gradient(178deg, ${BONE}, #E2DAC5)`,
              boxShadow: '0 6px 14px -8px rgba(0,0,0,0.55)',
              transform: 'rotate(-0.35deg)',
            }}
          >
            <h1 className="docket" style={{ margin: 0, fontSize: 16, letterSpacing: '0.26em', fontWeight: 700 }}>
              Bible Books Tracker
            </h1>
            <p className="docket" style={{ margin: '6px 0 0', fontSize: 10, letterSpacing: '0.22em', color: 'rgba(26,25,21,0.62)', fontWeight: 500 }}>
              Sewing record · Vol {CYCLE} · {READER}
            </p>
          </div>
          {/* Two strips of gummed tape holding the docket down. */}
          <span aria-hidden style={tape(-8, 18)} />
          <span aria-hidden style={tape(-8, 168)} />
        </header>

        <p
          className="docket"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 26px', margin: '0 0 26px', fontSize: 11, letterSpacing: '0.18em' }}
        >
          <span style={{ color: MADDER, fontWeight: 700 }}>{totalRead.toLocaleString()} stations sewn</span>
          <span style={{ color: 'rgba(26,25,21,0.72)' }}>of {TOTAL_CHAPTERS.toLocaleString()}</span>
          <span style={{ color: 'rgba(26,25,21,0.72)' }}>{closed} quires closed</span>
          <span style={{ color: 'rgba(26,25,21,0.72)' }}>{CURRENT_STREAK} days at the frame</span>
        </p>

        {/* The bench slip. */}
        <section
          aria-label="Sew chapters"
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 26px',
            padding: '20px 24px', marginBottom: 40,
            background: `linear-gradient(178deg, ${BONE}, #E4DCC7)`,
            boxShadow: '0 10px 22px -14px rgba(0,0,0,0.6)',
            position: 'relative',
          }}
        >
          {/* The slip is tacked to the bench with a run of stitches, not a colour bar. */}
          <span
            aria-hidden
            style={{
              position: 'absolute', left: 0, right: 0, top: 6, height: 2,
              backgroundImage: `linear-gradient(90deg, ${MADDER} 0 9px, transparent 9px 16px)`,
              backgroundSize: '16px 100%',
            }}
          />
          <div style={{ flex: '0 1 300px', minWidth: 0 }}>
            <h2 className="docket" style={{ margin: 0, fontSize: 26, letterSpacing: '0.06em', fontWeight: 700 }}>
              {selected ? selected.name : 'Choose a quire'}
            </h2>
            {selected && (
              <p className="docket" style={{ margin: '7px 0 0', fontSize: 10.5, letterSpacing: '0.12em', color: 'rgba(26,25,21,0.66)', fontWeight: 500 }}>
                {selected.chapters_read} of {selected.num_chapters} stations · {selected.category}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <label>
              <span className="docket" style={{ display: 'block', fontSize: 9, letterSpacing: '0.24em', marginBottom: 7, color: 'rgba(26,25,21,0.66)' }}>
                Stations
              </span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sew() }}
                placeholder="1-4, 9"
                disabled={!selected}
                className="docket"
                style={{
                  width: 140, padding: '10px 12px', fontSize: 15, fontWeight: 500, letterSpacing: '0.06em',
                  background: '#FBF7EC', color: 'var(--ink)',
                  border: `1px solid ${invalid ? MADDER : 'rgba(26,25,21,0.34)'}`,
                  borderRadius: 0, outline: 'none',
                }}
              />
            </label>
            <button
              onClick={sew}
              disabled={newChapters.length === 0}
              className="docket"
              style={{
                padding: '11px 24px', fontSize: 11, letterSpacing: '0.24em', fontWeight: 700,
                background: newChapters.length ? MADDER : 'rgba(26,25,21,0.10)',
                color: newChapters.length ? BONE : 'rgba(26,25,21,0.42)',
                boxShadow: newChapters.length ? '0 2px 0 #6F1F19' : 'none',
                cursor: newChapters.length ? 'pointer' : 'not-allowed',
              }}
            >
              Sew
            </button>
          </div>

          <p className="docket" style={{ flexBasis: '100%', margin: 0, fontSize: 10.5, letterSpacing: '0.1em', fontWeight: 500, color: invalid ? MADDER : 'rgba(26,25,21,0.62)' }}>
            {invalid
              ? `No station ${input.trim()} in ${selected?.name ?? 'this quire'} — it has ${selected?.num_chapters ?? 0}.`
              : newChapters.length > 0
                ? `${newChapters.length} station${newChapters.length === 1 ? '' : 's'} to sew.`
                : 'Sewn stations are skipped; the thread only takes new ones.'}
          </p>
        </section>

        {/* The frame. Tapes cross every fold at the same three places, so a short
            gathering crosses one tape and Psalms crosses all three. */}
        <section aria-label="The sewing frame" style={{ position: 'relative', padding: '20px 26px', background: 'rgba(255,255,255,0.11)' }}>
          <span aria-hidden style={upright('left')} />
          <span aria-hidden style={upright('right')} />

          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '132px 1fr', columnGap: 16 }}>
            {/* Tapes sit behind the folds; the thread passes over them. */}
            <div aria-hidden style={{ position: 'absolute', left: 148, right: 0, top: -6, bottom: -6, pointerEvents: 'none' }}>
              {TAPES.map(t => (
                <span
                  key={t}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${t * 100}%`, width: 22,
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.18), var(--linen) 22%, #DED4B7 55%, var(--linen) 80%, rgba(0,0,0,0.18))',
                    boxShadow: '0 0 10px -3px rgba(0,0,0,0.4)',
                  }}
                />
              ))}
            </div>

            {books.map(b => (
              <Fold
                key={b.book_id}
                book={b}
                selected={b.book_id === selectedId}
                sewing={b.book_id === sewingId}
                onSelect={() => { setSelectedId(b.book_id); setInput('') }}
              />
            ))}
          </div>
        </section>

        {/* A year of work as one thread laid end to end. */}
        <section aria-label="Days at the frame" style={{ marginTop: 44 }}>
          <h2 className="docket" style={{ fontSize: 10, letterSpacing: '0.26em', margin: '0 0 14px', fontWeight: 600, color: 'rgba(26,25,21,0.72)' }}>
            One year of thread
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, height: 40, padding: '0 10px', background: `linear-gradient(178deg, ${BONE}, #E2DAC5)` }}>
            {year.map((c, i) => (
              <span
                key={i}
                title={c ? `${c} chapters` : 'no thread'}
                style={{
                  flex: 1,
                  height: c ? `${Math.min(14 + c * 2.2, 30)}px` : 2,
                  background: c ? MADDER : 'rgba(26,25,21,0.2)',
                  opacity: c ? 0.4 + Math.min(c / 11, 1) * 0.6 : 1,
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

const tape = (top: number, left: number): React.CSSProperties => ({
  position: 'absolute', top, left, width: 62, height: 22,
  background: 'linear-gradient(180deg, rgba(215,205,175,0.85), rgba(196,185,155,0.8))',
  boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
  transform: 'rotate(-3deg)',
})

const upright = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 12,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.5), var(--walnut) 40%, #5A452F 70%, rgba(0,0,0,0.45))',
})
