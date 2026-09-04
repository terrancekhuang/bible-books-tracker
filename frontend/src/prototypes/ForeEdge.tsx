/*
  WORLD · FORE-EDGE
  THESIS: The Bible seen from its edges, not its face. A chapter is one leaf of the
  block; reading it gilds that edge. Refuses the dashboard-of-cards arrangement — there
  is no card on this page, only a book block, a shelf, and a bench.
  OWN-WORLD: oxblood morocco and forest bookcloth grounds, gold leaf as the earned state,
  raw untrimmed paper as unread, category leather dyes on nine thumb tabs, Bodoni foil
  stamping over Archivo.
  STORY: How much of the book have I gilded, which volume am I on, what do I gild next.
  FIRST VIEWPORT: full-bleed block of 1,189 chapter edges under a stamped spine band,
  the edition statement beneath it, the bench (primary action) immediately below.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOOKS, ACTIVITY, CURRENT_STREAK, READING_DAYS, CYCLE } from './seed'
import { parseChapters, splitAlreadyRead, TOTAL_CHAPTERS, type Book } from '../lib/trackerLogic'

const DYE: Record<string, string> = {
  'Law': '#7A4A12',
  'History': '#5C2018',
  'Poetry': '#1B3A2C',
  'Major Prophets': '#2A2F5C',
  'Minor Prophets': '#3E3670',
  'Gospels': '#124A4A',
  'Church History': '#6A2E4A',
  "Paul's Epistles": '#4A4212',
  'General Epistles': '#6B3410',
}
const CATEGORIES = Object.keys(DYE)

const GOLD = '#C9962C'
const GOLD_LIT = '#E8C46A'
const PAPER = '#DED5C4'

/* ── The block ───────────────────────────────────────────────────────────────
   1,189 chapter edges drawn end to end. At any usable width a chapter is about
   one pixel, which is why this is a canvas and not 1,189 elements: the striations
   have to stay hairline-crisp on a retina panel, and no DOM node survives that. */
function Block({
  books, selectedId, gilding,
}: { books: Book[]; selectedId: number | null; gilding: Set<number> }) {
  const ref = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const unit = w / TOTAL_CHAPTERS
    const headBand = 7
    let x = 0

    let markX = -1
    let markW = 0

    for (const book of books) {
      const bw = unit * book.num_chapters
      if (book.book_id === selectedId) { markX = x; markW = bw }

      // Head band: the category dye showing on the top edge of the gathering.
      ctx.globalAlpha = 1
      ctx.fillStyle = DYE[book.category] ?? '#5C2018'
      ctx.fillRect(x, 0, bw, headBand)

      for (let c = 1; c <= book.num_chapters; c++) {
        const cx = x + unit * (c - 1)
        const read = c <= book.chapters_read
        const fresh = book.book_id === selectedId && gilding.has(c)
        ctx.globalAlpha = 1
        ctx.fillStyle = fresh ? GOLD_LIT : read ? GOLD : PAPER
        ctx.fillRect(cx, headBand, Math.max(unit - 0.3, 0.6), h - headBand)
        // Every leaf catches a little light on its left face.
        ctx.globalAlpha = read ? 0.32 : 0.5
        ctx.fillStyle = read ? '#FFF0C4' : '#FFFFFF'
        ctx.fillRect(cx, headBand, Math.min(unit * 0.34, 0.6), h - headBand)
      }

      // The score between gatherings.
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(20,17,15,0.5)'
      ctx.fillRect(x + bw - 0.5, 0, 0.9, h)
      x += bw
    }

    // The block sits in a press: shadow down the head, light along the foot.
    const shade = ctx.createLinearGradient(0, headBand, 0, h)
    shade.addColorStop(0, 'rgba(20,17,15,0.26)')
    shade.addColorStop(0.22, 'rgba(20,17,15,0)')
    shade.addColorStop(0.86, 'rgba(20,17,15,0)')
    shade.addColorStop(1, 'rgba(20,17,15,0.22)')
    ctx.fillStyle = shade
    ctx.fillRect(0, headBand, w, h - headBand)

    // The binder's mark: brackets around the gathering at the bench.
    if (markX >= 0) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = GOLD_LIT
      ctx.lineWidth = 1.5
      const arm = Math.min(markW * 0.5, 16)
      ctx.beginPath()
      ctx.moveTo(markX - 0.75, 11); ctx.lineTo(markX - 0.75, 0.75); ctx.lineTo(markX + arm, 0.75)
      ctx.moveTo(markX + markW + 0.75, 11); ctx.lineTo(markX + markW + 0.75, 0.75); ctx.lineTo(markX + markW - arm, 0.75)
      ctx.moveTo(markX - 0.75, h - 11); ctx.lineTo(markX - 0.75, h - 0.75); ctx.lineTo(markX + arm, h - 0.75)
      ctx.moveTo(markX + markW + 0.75, h - 11); ctx.lineTo(markX + markW + 0.75, h - 0.75); ctx.lineTo(markX + markW - arm, h - 0.75)
      ctx.stroke()
    }
  }, [books, selectedId, gilding])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [draw])

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden />
}

/* ── The pricking calendar ───────────────────────────────────────────────────
   A scribe pricks the margin before ruling a page. One prick per day read. */
function Prickings({ activity }: { activity: { logged_at: string; chapters: number }[] }) {
  const byDay = useMemo(() => new Map(activity.map(a => [a.logged_at, a.chapters])), [activity])
  const weeks = useMemo(() => {
    const end = new Date('2026-09-04T00:00:00Z')
    const cols: { date: string; chapters: number }[][] = []
    const cursor = new Date(end)
    cursor.setUTCDate(cursor.getUTCDate() - 363)
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7))
    while (cursor <= end) {
      const col: { date: string; chapters: number }[] = []
      for (let d = 0; d < 7; d++) {
        const iso = cursor.toISOString().slice(0, 10)
        col.push({ date: iso, chapters: cursor <= end ? (byDay.get(iso) ?? 0) : -1 })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      cols.push(col)
    }
    return cols
  }, [byDay])

  const opacity = (c: number) => (c < 0 ? 0 : c === 0 ? 0.16 : c <= 2 ? 0.4 : c <= 5 ? 0.62 : c <= 10 ? 0.82 : 1)

  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
      {weeks.map((col, i) => (
        <div key={i} style={{ display: 'grid', gap: 3 }}>
          {col.map(day => (
            <div
              key={day.date}
              title={day.chapters > 0 ? `${day.date} · ${day.chapters} chapters` : day.date}
              style={{
                width: 9, height: 9, borderRadius: 1,
                background: day.chapters > 0 ? GOLD : 'rgba(222,213,196,0.9)',
                opacity: opacity(day.chapters),
                boxShadow: day.chapters > 0 ? 'inset 0 0 0 0.5px rgba(20,17,15,0.35)' : 'none',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function ForeEdge() {
  const [books, setBooks] = useState<Book[]>(BOOKS)
  const [selectedId, setSelectedId] = useState<number | null>(45)
  const [input, setInput] = useState('12-16')
  const [gilding, setGilding] = useState<Set<number>>(new Set())
  const [sweep, setSweep] = useState(0)

  const selected = books.find(b => b.book_id === selectedId) ?? null
  const totalRead = useMemo(() => books.reduce((s, b) => s + b.chapters_read, 0), [books])
  const bound = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])
  const pct = Math.round((totalRead / TOTAL_CHAPTERS) * 100)

  const parsed = selected ? parseChapters(input, selected.num_chapters) : []
  const { newChapters } = selected
    ? splitAlreadyRead(parsed, selected.chapters_read_list)
    : { newChapters: [] as number[] }
  const invalid = input.trim().length > 0 && parsed.length === 0

  const gild = () => {
    if (!selected || newChapters.length === 0) return
    setGilding(new Set(newChapters))
    setSweep(s => s + 1)
    window.setTimeout(() => {
      setBooks(prev => prev.map(b => {
        if (b.book_id !== selected.book_id) return b
        const list = [...new Set([...b.chapters_read_list, ...newChapters])].sort((a, c) => a - c)
        return { ...b, chapters_read: list.length, chapters_read_list: list }
      }))
      setGilding(new Set())
      setInput('')
    }, 620)
  }

  return (
    <div className="w-edge">
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1180, margin: '0 auto', padding: '22px 32px 72px' }}>

        {/* Spine band — the label a binder stamps across the back of the book. */}
        <header
          style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 24, padding: '26px 0 22px', marginBottom: 30,
            borderTop: `2px solid ${GOLD}`, borderBottom: `1px solid rgba(201,150,44,0.42)`,
          }}
        >
          <h1 className="stamp" style={{ margin: 0, fontSize: 'clamp(14px, 3.4vw, 19px)', fontWeight: 500, letterSpacing: 'clamp(0.14em, 1.4vw, 0.30em)' }}>
            Bible Books Tracker
          </h1>
          <p className="stamp edge-num" style={{ margin: 0, fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: 'clamp(0.12em, 1vw, 0.34em)', opacity: 0.82 }}>
            Vol.&nbsp;{CYCLE} · Terrance Huang
          </p>
        </header>

        {/* The block. */}
        <section aria-label="The book block, chapter by chapter">
          <div
            style={{
              height: 210, borderRadius: 2, overflow: 'hidden', position: 'relative',
              boxShadow: '0 22px 44px -18px rgba(0,0,0,0.72), 0 2px 0 rgba(255,229,168,0.16)',
            }}
          >
            <Block books={books} selectedId={selectedId} gilding={gilding} />
            {sweep > 0 && (
              <div
                key={sweep}
                aria-hidden
                style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: `linear-gradient(90deg, transparent, ${GOLD_LIT}66 46%, #FFF3D0aa 52%, transparent)`,
                  animation: 'gild 620ms cubic-bezier(0.16,1,0.3,1) both',
                }}
              />
            )}
          </div>
          <p
            className="stamp edge-num"
            style={{ margin: '18px 0 0', fontSize: 12, letterSpacing: '0.26em', display: 'flex', flexWrap: 'wrap', gap: '0 22px' }}
          >
            <span style={{ color: GOLD_LIT }}>{totalRead.toLocaleString()} of {TOTAL_CHAPTERS.toLocaleString()} gilded</span>
            <span style={{ color: 'rgba(222,213,196,0.68)' }}>{pct}%</span>
            <span style={{ color: 'rgba(222,213,196,0.68)' }}>{bound} of 66 bound</span>
            <span style={{ color: 'rgba(222,213,196,0.68)' }}>{CURRENT_STREAK} days at the bench</span>
            <span style={{ color: 'rgba(222,213,196,0.68)' }}>{READING_DAYS} days this volume</span>
          </p>
        </section>

        {/* The bench — the primary action, high on the page and under the thumb. */}
        <section
          aria-label="Gild chapters"
          style={{
            marginTop: 40, padding: '26px 28px', borderRadius: 3,
            background: 'linear-gradient(180deg, #1F4232 0%, #16301F 100%)',
            border: '1px solid rgba(201,150,44,0.30)',
            boxShadow: '0 18px 38px -22px rgba(0,0,0,0.8)',
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '18px 34px',
          }}
        >
          <div style={{ flex: '0 1 340px', minWidth: 0 }}>
            <h2
              style={{
                margin: 0, fontFamily: "'Bodoni Moda', serif", fontWeight: 500, fontSize: 34,
                lineHeight: 1.05, color: '#F3E9D6', letterSpacing: '-0.01em',
              }}
            >
              {selected ? selected.name : 'Choose a gathering'}
            </h2>
            {selected && (
              <p className="edge-num" style={{ margin: '9px 0 0', fontSize: 13, color: 'rgba(222,213,196,0.7)' }}>
                {selected.chapters_read} of {selected.num_chapters} leaves gilded · {selected.category} · at the bench
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flex: '0 0 auto' }}>
            <label style={{ display: 'block' }}>
              <span className="stamp" style={{ display: 'block', fontSize: 9, letterSpacing: '0.3em', marginBottom: 8, opacity: 0.8 }}>
                Leaves
              </span>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') gild() }}
                placeholder="1-4, 9"
                disabled={!selected}
                className="edge-num"
                style={{
                  width: 150, padding: '11px 13px', fontSize: 15,
                  background: 'rgba(20,17,15,0.5)', color: '#F3E9D6',
                  border: `1px solid ${invalid ? '#C4574A' : 'rgba(201,150,44,0.42)'}`,
                  borderRadius: 2, outline: 'none', fontFamily: 'Archivo, sans-serif',
                }}
              />
            </label>
            <button
              onClick={gild}
              disabled={newChapters.length === 0}
              className="stamp"
              style={{
                padding: '12px 24px', fontSize: 11, borderRadius: 2,
                background: newChapters.length ? GOLD : 'rgba(201,150,44,0.16)',
                color: newChapters.length ? '#231404' : 'rgba(222,213,196,0.4)',
                textShadow: 'none', letterSpacing: '0.24em',
                boxShadow: newChapters.length ? '0 2px 0 #8A6414, 0 10px 18px -10px rgba(0,0,0,0.9)' : 'none',
                cursor: newChapters.length ? 'pointer' : 'not-allowed',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }}
            >
              Gild
            </button>
          </div>

          <p
            className="edge-num"
            style={{ flexBasis: '100%', margin: 0, fontSize: 12.5, color: invalid ? '#E29A8E' : 'rgba(222,213,196,0.58)' }}
          >
            {invalid
              ? `That is not a range inside ${selected?.name ?? 'this book'}. Try 1-4 or 9.`
              : newChapters.length > 0
                ? `${newChapters.length} ${newChapters.length === 1 ? 'leaf' : 'leaves'} to gild.`
                : 'Enter chapters as a range or a list. Already-gilded leaves are skipped.'}
          </p>
        </section>

        {/* The shelf. Every book stands on its foot; the gilt band is what you have read. */}
        <section aria-label="The shelf" style={{ marginTop: 52 }}>
          <h2 className="stamp" style={{ fontSize: 10, letterSpacing: '0.34em', margin: '0 0 22px', fontWeight: 500 }}>
            The shelf
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '34px 30px' }}>
            {CATEGORIES.map(cat => {
              const inCat = books.filter(b => b.category === cat)
              if (inCat.length === 0) return null
              return (
                <div key={cat}>
                  <p
                    className="stamp"
                    style={{ margin: '0 0 10px', fontSize: 9, letterSpacing: '0.26em', color: 'rgba(222,213,196,0.5)' }}
                  >
                    {cat}
                  </p>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                    {inCat.map(b => {
                      const p = b.chapters_read / b.num_chapters
                      const active = b.book_id === selectedId
                      return (
                        <button
                          key={b.book_id}
                          onClick={() => { setSelectedId(b.book_id); setInput('') }}
                          aria-pressed={active}
                          title={`${b.name} — ${b.chapters_read}/${b.num_chapters}`}
                          style={{
                            position: 'relative', width: 30, height: 148, borderRadius: '1px 1px 0 0',
                            background: `linear-gradient(90deg, rgba(0,0,0,0.42), ${DYE[cat]} 34%, ${DYE[cat]} 72%, rgba(255,255,255,0.10))`,
                            border: active ? `1px solid ${GOLD_LIT}` : '1px solid rgba(0,0,0,0.45)',
                            overflow: 'hidden',
                            transform: active ? 'translateY(-9px)' : 'none',
                            boxShadow: active
                              ? `0 14px 22px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(232,196,106,0.35)`
                              : '0 8px 14px -10px rgba(0,0,0,0.85)',
                            transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms ease',
                          }}
                        >
                          {/* Gilt band: the read portion, measured from the foot. Scaled
                              rather than resized, so gilding a book does not relayout the shelf. */}
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute', right: 0, bottom: 0, width: 9, height: '100%',
                              transform: `scaleY(${p})`, transformOrigin: 'bottom',
                              background: `linear-gradient(90deg, #6E4E0E, ${GOLD} 34%, ${GOLD_LIT} 66%, #A87C1C)`,
                              boxShadow: 'inset 1px 0 0 rgba(20,17,15,0.45)',
                              transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1)',
                            }}
                          />
                          {/* The unread remainder of the edge: raw, untrimmed paper. */}
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute', right: 0, top: 0, width: 9, height: '100%',
                              transform: `scaleY(${1 - p})`, transformOrigin: 'top',
                              background: `linear-gradient(90deg, #9C9483, ${PAPER} 40%, #F1E9D8 70%, #B6AD9A)`,
                              boxShadow: 'inset 1px 0 0 rgba(20,17,15,0.45)',
                              transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1)',
                            }}
                          />
                          <span
                            style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0, right: 9,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                              fontFamily: "'Bodoni Moda', serif", fontSize: 9.5, letterSpacing: '0.03em',
                              textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
                              padding: '6px 0',
                              color: '#F3E7D0',
                              textShadow: '0 1px 2px rgba(0,0,0,0.75)',
                            }}
                          >
                            {b.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section aria-label="Days at the bench" style={{ marginTop: 56 }}>
          <h2 className="stamp" style={{ fontSize: 10, letterSpacing: '0.34em', margin: '0 0 18px', fontWeight: 500 }}>
            Prickings · one year
          </h2>
          <Prickings activity={ACTIVITY} />
        </section>
      </div>
    </div>
  )
}
