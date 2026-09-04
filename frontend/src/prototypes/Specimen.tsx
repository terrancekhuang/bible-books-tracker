/*
  WORLD · SPECIMEN
  THESIS: Progress is not drawn beside the type, progress is the weight axis of the type.
  Refuses the ring-and-card dashboard: there is no chart on this page, because the
  letterforms are the chart.
  OWN-WORLD: near-white paper, ink black, one live blue, hairline rules, Literata on its
  200–900 weight axis at specimen scale against tiny mono measurement labels.
  STORY: how far into each book am I, which are thin, log the next chapters.
  FIRST VIEWPORT: the in-flight book set at specimen scale with its weight interpolated
  by progress, the mono readout and the logging field on the same baseline beneath it.
*/
import { useMemo, useState } from 'react'
import { BOOKS, ACTIVITY, CURRENT_STREAK, READING_DAYS, CYCLE, READER } from './seed'
import { parseChapters, splitAlreadyRead, TOTAL_CHAPTERS, type Book } from '../lib/trackerLogic'

/** The axis binding: 0% read is hairline, 100% is black. Everything else follows. */
const weightOf = (b: Book) => Math.round(200 + (b.chapters_read / b.num_chapters) * 700)

function Rule({ top = 0, bottom = 0 }: { top?: number; bottom?: number }) {
  return <hr style={{ border: 0, borderTop: '1px solid var(--rule)', margin: `${top}px 0 ${bottom}px` }} />
}

export default function Specimen() {
  const [books, setBooks] = useState<Book[]>(BOOKS)
  const [focusId, setFocusId] = useState(45)
  const [pinnedId, setPinnedId] = useState(45)
  const [input, setInput] = useState('12-16')

  const focus = books.find(b => b.book_id === focusId) ?? books[0]
  const pinned = books.find(b => b.book_id === pinnedId) ?? books[0]

  const totalRead = useMemo(() => books.reduce((s, b) => s + b.chapters_read, 0), [books])
  const complete = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])

  const parsed = parseChapters(input, pinned.num_chapters)
  const { newChapters } = splitAlreadyRead(parsed, pinned.chapters_read_list)
  const invalid = input.trim().length > 0 && parsed.length === 0

  const log = () => {
    if (newChapters.length === 0) return
    setBooks(prev => prev.map(b => {
      if (b.book_id !== pinned.book_id) return b
      const list = [...new Set([...b.chapters_read_list, ...newChapters])].sort((x, y) => x - y)
      return { ...b, chapters_read: list.length, chapters_read_list: list }
    }))
    setInput('')
  }

  // Distribution across the axis — how many books sit at each weight stop.
  const ramp = useMemo(() => {
    const stops = [200, 300, 400, 500, 600, 700, 800, 900]
    return stops.map(s => ({
      stop: s,
      count: books.filter(b => Math.round(weightOf(b) / 100) * 100 === s).length,
    }))
  }, [books])

  const recent = useMemo(() => ACTIVITY.slice(-182), [])
  const maxDay = Math.max(...recent.map(a => a.chapters), 1)

  return (
    <div className="w-spec">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 40px 96px' }}>

        {/* Running head. Every number on this page is a measurement, so every number is mono. */}
        <header
          className="mono"
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
            padding: '30px 0 12px', fontSize: 10, letterSpacing: '0.02em',
            textTransform: 'uppercase', color: 'var(--mute)',
          }}
        >
          <span>Bible Books Tracker · {READER}</span>
          <span>Literata wght 200–900 · 66 specimens · cycle {String(CYCLE).padStart(2, '0')}</span>
        </header>
        <Rule bottom={0} />

        {/* The specimen at size. Weight is progress; nothing else has to say so. */}
        <section aria-label="Book in progress" style={{ padding: '26px 0 0' }}>
          <div
            className="spec-name"
            style={{
              fontSize: 'clamp(3.5rem, 13vw, 10.5rem)',
              lineHeight: 0.86,
              letterSpacing: '-0.035em',
              fontVariationSettings: `"wght" ${weightOf(focus)}`,
              color: focus.book_id === pinned.book_id ? 'var(--ink)' : 'var(--live)',
              textWrap: 'balance',
            }}
          >
            {focus.name}
          </div>

          <div
            className="mono"
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 28px',
              marginTop: 26, fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase',
            }}
          >
            <span style={{ color: 'var(--ink)' }}>wght {weightOf(focus)}</span>
            <span>{focus.chapters_read} / {focus.num_chapters} chapters</span>
            <span>{focus.category}</span>
            <span>{focus.testament}</span>
          </div>
        </section>

        {/* The axis. Each tick is one book at its own weight; the crowd at 200 is the backlog. */}
        <section aria-label="Weight distribution" style={{ marginTop: 44 }}>
          <Rule bottom={14} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 62 }}>
            {[...books]
              .sort((a, b) => weightOf(a) - weightOf(b))
              .map(b => (
                <button
                  key={b.book_id}
                  onMouseEnter={() => setFocusId(b.book_id)}
                  onFocus={() => setFocusId(b.book_id)}
                  onClick={() => { setPinnedId(b.book_id); setInput('') }}
                  title={`${b.name} — wght ${weightOf(b)}`}
                  style={{
                    flex: 1,
                    height: `${((weightOf(b) - 200) / 700) * 100}%`,
                    minHeight: 2,
                    background: b.book_id === focus.book_id ? 'var(--live)' : 'var(--ink)',
                    opacity: b.book_id === focus.book_id ? 1 : 0.26,
                    transition: 'opacity 140ms ease, background-color 140ms ease',
                  }}
                />
              ))}
          </div>
          <div
            className="mono"
            style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 8,
              fontSize: 9.5, color: 'var(--mute)', textTransform: 'uppercase',
            }}
          >
            {ramp.map(r => (
              <span key={r.stop}>{r.stop}<span style={{ opacity: 0.5 }}> · {r.count}</span></span>
            ))}
          </div>
        </section>

        {/* The setting field. One line, one action, on the paper — no panel around it. */}
        <section aria-label="Log chapters" style={{ marginTop: 52 }}>
          <Rule bottom={22} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '14px 20px' }}>
            <span
              className="spec-name"
              style={{ fontSize: 30, fontVariationSettings: `"wght" ${weightOf(pinned)}`, letterSpacing: '-0.02em' }}
            >
              {pinned.name}
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mute)' }}>
                set chapters
              </span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') log() }}
                placeholder="1-4, 9"
                className="mono"
                style={{
                  width: 140, padding: '4px 2px', fontSize: 15,
                  background: 'transparent', color: 'var(--ink)',
                  border: 0, borderBottom: `2px solid ${invalid ? '#B3341F' : 'var(--live)'}`,
                  borderRadius: 0, outline: 'none',
                }}
              />
            </label>
            <button
              onClick={log}
              disabled={newChapters.length === 0}
              className="mono"
              style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
                padding: '8px 18px',
                background: newChapters.length ? 'var(--live)' : 'transparent',
                color: newChapters.length ? 'var(--paper)' : 'var(--mute)',
                border: newChapters.length ? '2px solid var(--live)' : '2px solid var(--rule)',
                cursor: newChapters.length ? 'pointer' : 'not-allowed',
              }}
            >
              Set
            </button>
            <span
              className="mono"
              style={{ fontSize: 11, color: invalid ? '#B3341F' : 'var(--mute)', textTransform: 'uppercase' }}
            >
              {invalid
                ? `outside ${pinned.name} 1–${pinned.num_chapters}`
                : newChapters.length > 0
                  ? `+${newChapters.length} → wght ${Math.round(200 + ((pinned.chapters_read + newChapters.length) / pinned.num_chapters) * 700)}`
                  : 'ranges and lists both parse'}
            </span>
          </div>
        </section>

        {/* The full specimen. Sixty-six names, each at its own weight, in canon order. */}
        <section aria-label="All sixty-six books" style={{ marginTop: 56 }}>
          <Rule bottom={0} />
          <p className="mono" style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mute)', margin: '12px 0 22px' }}>
The complete specimen · weight is progress · point to set, click to pin
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              columnGap: 26, rowGap: 4,
            }}
          >
            {books.map(b => (
              <button
                key={b.book_id}
                onMouseEnter={() => setFocusId(b.book_id)}
                onFocus={() => setFocusId(b.book_id)}
                onClick={() => { setPinnedId(b.book_id); setInput('') }}
                className="spec-name"
                style={{
                  textAlign: 'left', fontSize: 25, lineHeight: 1.2, letterSpacing: '-0.02em',
                  fontVariationSettings: `"wght" ${weightOf(b)}`,
                  color: b.book_id === focus.book_id ? 'var(--live)' : 'var(--ink)',
                  opacity: b.chapters_read === 0 ? 0.62 : 1,
                  padding: '3px 0', minHeight: 62,
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </section>

        {/* The measurement block: half a year of days, set as a matrix. */}
        <section aria-label="Last one hundred and eighty-two days" style={{ marginTop: 60 }}>
          <Rule bottom={0} />
          <p className="mono" style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mute)', margin: '12px 0 16px' }}>
            Days · last 182
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 54 }}>
            {recent.map(a => (
              <div
                key={a.logged_at}
                title={`${a.logged_at} · ${a.chapters} chapters`}
                style={{
                  flex: 1, minWidth: 2,
                  height: `${Math.max((a.chapters / maxDay) * 100, 6)}%`,
                  background: 'var(--live)',
                  opacity: 0.32 + (a.chapters / maxDay) * 0.68,
                }}
              />
            ))}
          </div>
        </section>

        <footer style={{ marginTop: 54 }}>
          <Rule bottom={14} />
          <p
            className="mono"
            style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px 30px', margin: 0,
              fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)',
            }}
          >
            <span style={{ color: 'var(--ink)' }}>{totalRead.toLocaleString()} / {TOTAL_CHAPTERS.toLocaleString()} chapters</span>
            <span>{complete} / 66 complete</span>
            <span>{CURRENT_STREAK}d streak</span>
            <span>{READING_DAYS} reading days</span>
          </p>
        </footer>
      </div>
    </div>
  )
}
