/*
  WORLD · DEPARTURE BOARD
  THESIS: Sixty-six books are sixty-six live rows on one split-flap board, ranked by
  when you last read them. Refuses the card grid: there is exactly one object on this
  page, and it is a board in a steel frame.
  OWN-WORLD: matte black flap faces with a seam across every cell, white paint condensed
  caps in fixed character advance, brushed steel bezel and engraved rails, amber row
  lamps for in-flight, rust for untouched, blank white flaps for finished.
  STORY: what is in flight, what is finished, what has not departed, and log a chapter.
  FIRST VIEWPORT: the steel frame full-bleed, the in-flight book on the large upper
  board with its logging control, the sixty-six-row board below it.
*/
import { useEffect, useMemo, useState } from 'react'
import { BOOKS, CURRENT_STREAK, TOTAL_READ, CYCLE } from './seed'
import { parseChapters, splitAlreadyRead, TOTAL_CHAPTERS, type Book } from '../lib/trackerLogic'

const PAINT = '#F2F0EA'
const AMBER = '#E39A25'
const RUST = '#8E2A1C'

type SortKey = 'last' | 'name' | 'progress'

function status(b: Book): 'done' | 'flight' | 'held' {
  if (b.chapters_read >= b.num_chapters) return 'done'
  return b.chapters_read > 0 ? 'flight' : 'held'
}

function shortDate(iso: string | null): string {
  if (!iso) return '— —'
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}`
}

/** One painted character on its own flap. The seam is in .flapcell, not drawn here. */
function Flaps({ text, size = 15, width = 12, tone = PAINT, delay = 0 }: {
  text: string; size?: number; width?: number; tone?: string; delay?: number
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, perspective: 340 }}>
      {text.split('').map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className="flapcell board-caps"
          style={{
            width, height: size * 1.5, lineHeight: `${size * 1.5}px`,
            fontSize: size, textAlign: 'center', color: tone,
            borderRadius: 1.5, transformOrigin: 'center top',
            animation: `flap-in 320ms cubic-bezier(0.2,0.9,0.25,1.06) both`,
            animationDelay: `${delay + i * 14}ms`,
          }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

/** The progress column: twenty-four flaps, filled left to right. */
function FlapBar({ pct, tone }: { pct: number; tone: string }) {
  const cells = 24
  const lit = Math.round((pct / 100) * cells)
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className="flapcell"
          style={{
            width: 7, height: 15, borderRadius: 1,
            boxShadow: i < lit ? `inset 0 0 0 7px ${tone}` : 'none',
            opacity: i < lit ? 1 : 0.5,
          }}
        />
      ))}
    </span>
  )
}

const railBtn = {
  textAlign: 'left' as const,
  letterSpacing: 'inherit',
  textTransform: 'uppercase' as const,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 500,
}

function Lamp({ state }: { state: 'done' | 'flight' | 'held' }) {
  const color = state === 'flight' ? AMBER : state === 'done' ? PAINT : RUST
  return (
    <span
      title={state === 'flight' ? 'In flight' : state === 'done' ? 'Complete' : 'Not departed'}
      style={{
        display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
        background: color,
        boxShadow: state === 'flight'
          ? `0 1px 3px rgba(0,0,0,0.6), 0 0 9px 1px ${AMBER}70`
          : '0 1px 3px rgba(0,0,0,0.6)',
      }}
    />
  )
}

/** Below this width the board drops Progress and Last and keeps the three columns
 *  a traveller actually reads at a glance: lamp, name, count. */
const NARROW = 760

export default function DepartureBoard() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW - 1}px)`)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const grid = narrow
    ? '20px minmax(0, 1fr) 78px'
    : '26px minmax(240px, 1fr) 96px 200px 96px'

  const [books, setBooks] = useState<Book[]>(BOOKS)
  const [sort, setSort] = useState<SortKey>('last')
  const [flip, setFlip] = useState(0)
  const [input, setInput] = useState('12')

  const rows = useMemo(() => {
    const copy = [...books]
    if (sort === 'name') copy.sort((a, b) => a.book_id - b.book_id)
    else if (sort === 'progress') copy.sort((a, b) => b.chapters_read / b.num_chapters - a.chapters_read / a.num_chapters)
    else copy.sort((a, b) => (b.last_read_at ?? '').localeCompare(a.last_read_at ?? ''))
    return copy
  }, [books, sort])

  const inFlight = rows.find(b => status(b) === 'flight') ?? rows[0]
  const parsed = parseChapters(input, inFlight.num_chapters)
  const { newChapters } = splitAlreadyRead(parsed, inFlight.chapters_read_list)
  const invalid = input.trim().length > 0 && parsed.length === 0
  const totalRead = books.reduce((s, b) => s + b.chapters_read, 0)

  const log = () => {
    if (newChapters.length === 0) return
    setBooks(prev => prev.map(b => {
      if (b.book_id !== inFlight.book_id) return b
      const list = [...new Set([...b.chapters_read_list, ...newChapters])].sort((x, y) => x - y)
      return { ...b, chapters_read: list.length, chapters_read_list: list, last_read_at: '2026-09-04T07:20:00Z' }
    }))
    setInput('')
    setFlip(f => f + 1)
  }

  const changeSort = (k: SortKey) => { setSort(k); setFlip(f => f + 1) }

  return (
    <div
      className="w-board"
      style={{
        padding: '22px 22px 40px',
        background: 'radial-gradient(120% 90% at 50% -20%, #4E535A, #2A2D31 70%)',
      }}
    >
      <div
        className="brushed"
        style={{
          maxWidth: 1180, margin: '0 auto', padding: 12, borderRadius: 5,
          boxShadow: '0 26px 60px -24px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {/* Engraved header rail. */}
        <div
          style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20,
            padding: '2px 6px 12px',
          }}
        >
          <h1
            className="board-caps"
            style={{
              margin: 0, fontSize: 15, letterSpacing: '0.30em', color: '#2E3238',
              textShadow: '0 1px 0 rgba(255,255,255,0.55)', fontWeight: 600,
            }}
          >
            Bible Books Tracker
          </h1>
          <p
            className="board-caps"
            style={{
              margin: 0, fontSize: 11, letterSpacing: '0.24em', color: '#3A3F45',
              textShadow: '0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            Service {String(CYCLE).padStart(2, '0')} · {totalRead.toLocaleString()}/{TOTAL_CHAPTERS.toLocaleString()} · Streak {CURRENT_STREAK}d
          </p>
        </div>

        <div style={{ background: 'var(--void)', borderRadius: 3, padding: '20px 20px 8px', boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.9)' }}>

          {/* The upper board: what is in flight, and the control that logs it. */}
          <section
            aria-label="In flight"
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 28,
              paddingBottom: 22, borderBottom: '1px solid rgba(242,240,234,0.14)',
            }}
          >
            <div style={{ flex: '1 1 380px', minWidth: 0 }}>
              <h2 key={`hero-${flip}-${inFlight.book_id}`} style={{ margin: 0 }}>
                <Flaps text={inFlight.name.toUpperCase()} size={narrow ? 26 : 34} width={narrow ? 20 : 26} />
              </h2>
              <p
                className="board-caps"
                style={{
                  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px',
                  margin: '16px 0 0', fontSize: 13, letterSpacing: '0.2em', color: 'rgba(242,240,234,0.66)',
                }}
              >
                <Lamp state="flight" />
                <span style={{ color: AMBER }}>In flight</span>
                <span>· {inFlight.chapters_read} of {inFlight.num_chapters} chapters</span>
                <span>· {inFlight.category}</span>
                <span>· last {shortDate(inFlight.last_read_at)}</span>
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <label>
                <span className="board-caps" style={{ display: 'block', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(242,240,234,0.62)', marginBottom: 8 }}>
                  Chapters
                </span>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') log() }}
                  placeholder="1-4, 9"
                  className="board-caps"
                  style={{
                    width: 148, padding: '11px 13px', fontSize: 17, letterSpacing: '0.12em',
                    background: '#141417', color: PAINT, borderRadius: 2, outline: 'none',
                    border: `1px solid ${invalid ? '#C4574A' : 'rgba(242,240,234,0.24)'}`,
                  }}
                />
              </label>
              <button
                onClick={log}
                disabled={newChapters.length === 0}
                className="board-caps"
                style={{
                  padding: '12px 26px', fontSize: 13, letterSpacing: '0.24em', borderRadius: 2,
                  background: newChapters.length ? AMBER : 'rgba(242,240,234,0.10)',
                  color: newChapters.length ? '#140D02' : 'rgba(242,240,234,0.34)',
                  boxShadow: newChapters.length ? '0 2px 0 #9A6612, 0 10px 20px -12px rgba(0,0,0,0.95)' : 'none',
                  cursor: newChapters.length ? 'pointer' : 'not-allowed',
                }}
              >
                Log
              </button>
            </div>

            <p
              className="board-caps"
              style={{ flexBasis: '100%', margin: 0, fontSize: 12, letterSpacing: '0.16em', color: invalid ? '#E8A296' : 'rgba(242,240,234,0.62)' }}
            >
              {invalid
                ? `No such chapter in ${inFlight.name}. Enter 1–${inFlight.num_chapters}.`
                : newChapters.length > 0
                  ? `${newChapters.length} chapter${newChapters.length === 1 ? '' : 's'} ready to board.`
                  : 'Ranges and lists both work. Chapters already read are skipped.'}
            </p>
          </section>

          {/* Column rail. */}
          <div
            className="board-caps"
            style={{
              display: 'grid',
              gridTemplateColumns: grid,
              gap: 14, alignItems: 'center',
              padding: '16px 4px 10px', fontSize: 9.5, letterSpacing: '0.30em',
              color: 'rgba(242,240,234,0.55)',
            }}
          >
            <span />
            <button onClick={() => changeSort('name')} style={{ ...railBtn, color: sort === 'name' ? AMBER : 'inherit' }}>Book</button>
            <span>Chapters</span>
            {!narrow && <button onClick={() => changeSort('progress')} style={{ ...railBtn, color: sort === 'progress' ? AMBER : 'inherit' }}>Progress</button>}
            {!narrow && <button onClick={() => changeSort('last')} style={{ ...railBtn, color: sort === 'last' ? AMBER : 'inherit' }}>Last</button>}
          </div>

          {/* The board. */}
          <div role="table" aria-label="All sixty-six books" style={{ maxHeight: 620, overflowY: 'auto' }}>
            {rows.map((b, i) => {
              const st = status(b)
              const pct = Math.round((b.chapters_read / b.num_chapters) * 100)
              const tone = st === 'done' ? PAINT : st === 'flight' ? AMBER : RUST
              return (
                <div
                  key={`${b.book_id}-${flip}`}
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: grid,
                    gap: 14, alignItems: 'center',
                    padding: '5px 4px',
                    borderBottom: '1px solid rgba(242,240,234,0.055)',
                  }}
                >
                  <span><Lamp state={st} /></span>
                  <span style={{ minWidth: 0, overflow: 'hidden', display: 'block' }}>
                    <Flaps
                      text={b.name.toUpperCase()}
                      size={narrow ? 12 : 15} width={narrow ? 11 : 13}
                      tone={st === 'held' ? 'rgba(242,240,234,0.45)' : PAINT}
                      delay={i * 9}
                    />
                  </span>
                  <span className="board-caps" style={{ fontSize: narrow ? 12 : 14, letterSpacing: '0.1em', color: st === 'held' ? 'rgba(242,240,234,0.52)' : PAINT }}>
                    {String(b.chapters_read).padStart(3, '0')}/{String(b.num_chapters).padStart(3, '0')}
                  </span>
                  {!narrow && <span><FlapBar pct={pct} tone={tone} /></span>}
                  {!narrow && (
                    <span className="board-caps" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'rgba(242,240,234,0.62)' }}>
                      {shortDate(b.last_read_at)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend rail. */}
          <div
            className="board-caps"
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center',
              padding: '14px 4px 10px', marginTop: 6,
              borderTop: '1px solid rgba(242,240,234,0.14)',
              fontSize: 10, letterSpacing: '0.26em', color: 'rgba(242,240,234,0.62)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Lamp state="flight" /> In flight</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Lamp state="done" /> Complete</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Lamp state="held" /> Not departed</span>
            <span style={{ marginLeft: 'auto', color: AMBER }}>{TOTAL_READ.toLocaleString()} chapters this service</span>
          </div>
        </div>
      </div>
    </div>
  )
}
