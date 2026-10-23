import { Link } from 'react-router-dom'
import NavBar from './components/NavBar'
import { HistoryDayRow, HistoryEmpty, HistoryError, HistorySkeleton } from './components/HistoryDays'
import { useCurrentUserQuery, useDashboardQuery, useHistoryQuery } from './lib/queries'
import { groupByMonth, plural } from './lib/historyLogic'
import { leafSurfaceStyle } from './lib/leafSurface'
import { GILT } from './lib/volumesTokens'

const dimText = 'rgba(35,31,26,0.7)'

export default function History() {
  const { data: user } = useCurrentUserQuery()
  // The lifetime totals already ride in the dashboard payload Profile shares.
  const { data: dashboard } = useDashboardQuery()
  const { data, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useHistoryQuery()
  const stats = dashboard?.stats
  const months = data ? groupByMonth(data.pages.flatMap(p => p.days)) : []

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

        <section aria-label="Reading history" style={{ marginTop: 4, padding: 'clamp(24px, 4vw, 52px)', ...leafSurfaceStyle(GILT) }}>
          <h1 className="slab" style={{ margin: 0, fontSize: 24 }}>Reading History</h1>
          {!!stats?.total_chapters && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: dimText }}>
              {plural(stats.total_chapters, 'chapter')} across {plural(stats.total_days, 'day')}
            </p>
          )}

          {!data ? (
            <div style={{ marginTop: 24 }}>
              {isPending ? <HistorySkeleton rows={6} /> : <HistoryError onRetry={() => refetch()} />}
            </div>
          ) : months.length === 0 ? (
            <div style={{ marginTop: 24 }}><HistoryEmpty /></div>
          ) : (
            <>
              {months.map(m => (
                <div key={m.key} style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6, borderBottom: '2px solid var(--color-ink)' }}>
                    <h2 className="slab" style={{ margin: 0, fontSize: 16 }}>{m.label}</h2>
                    <span style={{ fontSize: 12, color: dimText }}>{m.chapters} ch · {plural(m.days.length, 'day')}</span>
                  </div>
                  {m.days.map(d => <HistoryDayRow key={d.date} day={d} />)}
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
