import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from './components/NavBar'
import HistoryCalendar from './components/HistoryCalendar'
import { HistoryDayRow, HistoryEmpty, HistoryError, HistorySkeleton } from './components/HistoryDays'
import { useCurrentUserQuery, useDashboardQuery, useHistoryQuery } from './lib/queries'
import { groupByMonth, parseLocalDate, plural } from './lib/historyLogic'
import { leafSurfaceStyle } from './lib/leafSurface'
import { GILT } from './lib/volumesTokens'

const dimText = 'rgba(35,31,26,0.7)'
// How far the window can scroll from a picked day before the selection lets go.
const CLEAR_DISTANCE = 220
const leafPad = 'clamp(24px, 4vw, 52px)'

export default function History() {
  const { data: user } = useCurrentUserQuery()
  // The lifetime totals already ride in the dashboard payload Profile shares.
  const { data: dashboard } = useDashboardQuery()
  const { data, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useHistoryQuery()
  const stats = dashboard?.stats
  const activity = dashboard?.activity ?? []
  const months = data ? groupByMonth(data.pages.flatMap(p => p.days)) : []

  // The picked day, how far the reader has scrolled off it (0–1), and a tick so
  // picking the same day again scrolls back to it.
  const [sel, setSel] = useState<string | null>(null)
  const [fade, setFade] = useState(0)
  const [jump, setJump] = useState(0)
  const dim = 0.3 + 0.7 * fade
  const headRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  // The title and date pill stick just under the nav bar, so × and the calendar stay in reach.
  // Once stuck, its top edge is pinned 1px inside the observer's inset, so it reads as not fully visible.
  useLayoutEffect(() => {
    const head = headRef.current!
    const nav = document.querySelector('header')?.offsetHeight ?? 0
    head.style.top = `${nav}px`
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= nav),
      { rootMargin: `${-nav - 1}px 0px 0px 0px`, threshold: 1 },
    )
    observer.observe(head)
    return () => observer.disconnect()
  }, [])

  async function pick(date: string) {
    // Pages are whole months, newest first: keep loading until the oldest loaded day reaches the pick.
    let result = { data, hasNextPage, isFetchNextPageError: false }
    while (result.hasNextPage && !result.isFetchNextPageError && (result.data?.pages.at(-1)?.days.at(-1)?.date ?? '') > date) {
      result = await fetchNextPage()
    }
    setFade(0)
    setSel(date)
    setJump(j => j + 1)
  }

  // Bring the picked day to just under the sticky nav bar and title, or as high as the page allows,
  // then fade the dimming out as the reader scrolls away and clear it at CLEAR_DISTANCE.
  useLayoutEffect(() => {
    if (!sel) return
    const row = document.querySelector(`[data-day="${sel}"]`)
    if (!row) return
    const head = headRef.current!
    const covered = parseFloat(head.style.top) + head.offsetHeight
    const max = document.documentElement.scrollHeight - window.innerHeight
    const target = Math.max(0, Math.min(row.getBoundingClientRect().top + window.scrollY - covered - 8, max))
    window.scrollTo({ top: target, behavior: 'smooth' })

    // While the smooth scroll runs, scroll events are ours; it's settled after 150ms of quiet.
    let anchor = target
    let settling = true
    let timer = setTimeout(settle, 150)
    function settle() {
      settling = false
      anchor = window.scrollY
    }
    // ponytail: re-renders the list every scroll frame while a day is picked; rAF-throttle if it janks
    function onScroll() {
      if (settling) {
        clearTimeout(timer)
        timer = setTimeout(settle, 150)
        return
      }
      const dist = Math.abs(window.scrollY - anchor)
      if (dist >= CLEAR_DISTANCE) setSel(null)
      else setFade(dist / CLEAR_DISTANCE)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [sel, jump])

  useEffect(() => {
    if (!sel) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: 'var(--color-shelf)' }}>
      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      <div className="max-w-3xl mx-auto w-full px-4 py-4 md:py-10">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ minHeight: 44, color: 'rgba(242,236,221,0.85)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Profile
        </Link>

        <section aria-label="Reading history" style={{ position: 'relative', marginTop: 4, padding: leafPad, ...leafSurfaceStyle(GILT) }}>
          <div
            ref={headRef}
            style={{
              position: 'sticky', zIndex: 10, margin: `-16px calc(-1 * ${leafPad}) 0`, padding: `16px ${leafPad} 0`,
              // Unstuck it shows the leaf through; stuck it needs its own paper to cover the rows.
              background: stuck ? 'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px), var(--color-leaf)' : 'transparent',
              boxShadow: stuck ? '0 10px 12px -10px rgba(35,31,26,0.35)' : 'none',
            }}
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <h1 className="slab" style={{ margin: 0, fontSize: 24 }}>Reading History</h1>
                {!!stats?.total_chapters && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: dimText }}>
                    {plural(stats.total_chapters, 'chapter')} across {plural(stats.total_days, 'day')}
                  </p>
                )}
              </div>
              {activity.length > 0 && <HistoryCalendar activity={activity} selected={sel} onPick={pick} />}
            </div>

            {/* Height is held even when empty, so picking a day never shifts the list under the scroll. */}
            <div className="flex items-center" style={{ minHeight: 36 }}>
              {sel && (
                <span className="inline-flex items-center rounded-full" style={{ gap: 2, paddingLeft: 10, background: 'rgba(210,166,63,0.22)', fontSize: 12, fontWeight: 600 }}>
                  {parseLocalDate(sel).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <button type="button" onClick={() => setSel(null)} aria-label="Clear date" className="flex items-center justify-center" style={{ width: 28, height: 28, color: 'var(--color-ink)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </span>
              )}
            </div>
          </div>

          {!data ? (
            <div style={{ marginTop: 12 }}>
              {isPending ? <HistorySkeleton rows={6} /> : <HistoryError onRetry={() => refetch()} />}
            </div>
          ) : months.length === 0 ? (
            <div style={{ marginTop: 12 }}><HistoryEmpty /></div>
          ) : (
            <>
              {months.map((m, i) => (
                <div key={m.key} style={{ marginTop: i === 0 ? 12 : 24 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6, borderBottom: '2px solid var(--color-ink)',
                    transition: 'opacity 0.2s', opacity: !sel || sel.startsWith(m.key) ? 1 : dim,
                  }}>
                    <h2 className="slab" style={{ margin: 0, fontSize: 16 }}>{m.label}</h2>
                    <span style={{ fontSize: 12, color: dimText }}>{m.chapters} ch · {plural(m.days.length, 'day')}</span>
                  </div>
                  {m.days.map(d => (
                    <HistoryDayRow
                      key={d.date}
                      day={d}
                      style={{
                        padding: '12px 8px', margin: '0 -8px', borderRadius: 4, transition: 'opacity 0.2s, background 0.2s',
                        opacity: !sel || d.date === sel ? 1 : dim,
                        background: d.date === sel ? 'rgba(210,166,63,0.2)' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              ))}

              {hasNextPage && (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="block w-full text-xs font-semibold uppercase rounded-lg transition-colors disabled:opacity-50"
                  style={{ minHeight: 44, marginTop: 22, letterSpacing: '0.08em', color: 'var(--color-ink)', border: '1px solid rgba(35,31,26,0.3)' }}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load older'}
                </button>
              )}
              {isFetchNextPageError && !isFetchingNextPage && (
                <p className="text-xs text-center mt-2" style={{ color: 'var(--color-leaf-red)' }} role="alert">
                  Couldn't load older reading — please try again.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
