import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from './lib/ThemeContext'
import { useBooksQuery, useDashboardQuery } from './lib/queries'
import { useUpdateWeeklyGoal } from './lib/useDashboardMutations'
import { FlameIcon, CalendarIcon, CategoryIcon, PencilIcon, BookOpenIcon } from './components/Icons'
import { getCategoryPalette } from './lib/categoryColors'
import BookCard from './components/BookCard'
import Skeleton from './components/Skeleton'
import ActivityHeatmap from './components/ActivityHeatmap'
import CircularProgress from './components/CircularProgress'
import NavBar from './components/NavBar'
import ReadingRhythm from './components/ReadingRhythm'
import { TOTAL_CHAPTERS, TOTAL_BOOKS, calculateOverallProgress, type Book } from './lib/trackerLogic'

const CATEGORY_ORDER = [
  'Law', 'History', 'Poetry', 'Major Prophets', 'Minor Prophets',
  'Gospels', 'Church History', "Paul's Epistles", 'General Epistles',
]

function sumChapters(books: Book[]): number {
  return books.reduce((s, b) => s + b.num_chapters, 0)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const fadeUp = (delay: number): CSSProperties => ({
  animation: 'fade-slide-up 0.5s ease-out both',
  animationDelay: `${delay}ms`,
})


export default function Dashboard() {
  const { isDark, colors } = useTheme()
  const [displayPct, setDisplayPct] = useState(0)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [goalError, setGoalError] = useState<string | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const { data: books = [], isLoading: booksLoading } = useBooksQuery()
  const { data: dashboard, isLoading: dashboardLoading } = useDashboardQuery()
  const { save: saveWeeklyGoal } = useUpdateWeeklyGoal()
  const isInitialLoading = booksLoading || dashboardLoading

  const stats = dashboard?.stats ?? null
  const activity = dashboard?.activity ?? null
  const user = dashboard?.user ?? null

  const weeklyGoal = dashboard?.weekly_goal ?? 7

  const { totalRead, overallPct } = useMemo(() => calculateOverallProgress(books), [books])
  const booksComplete = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])

  const continueBooks = useMemo(() => books
    .filter(b => b.chapters_read > 0 && b.chapters_read < b.num_chapters)
    .sort((a, b) => {
      if (!a.last_read_at && !b.last_read_at) return 0
      if (!a.last_read_at) return 1
      if (!b.last_read_at) return -1
      return b.last_read_at.localeCompare(a.last_read_at)
    })
    .slice(0, 3), [books])

  const otRead = useMemo(() => books.filter(b => b.testament === 'Old Testament').reduce((s, b) => s + b.chapters_read, 0), [books])
  const ntRead = useMemo(() => books.filter(b => b.testament === 'New Testament').reduce((s, b) => s + b.chapters_read, 0), [books])
  const otTotal = useMemo(() => sumChapters(books.filter(b => b.testament === 'Old Testament')), [books])
  const ntTotal = useMemo(() => sumChapters(books.filter(b => b.testament === 'New Testament')), [books])

  const categoryProgress = useMemo(() => CATEGORY_ORDER.map(cat => {
    const booksInCategory = books.filter(b => b.category === cat)
    const catRead = booksInCategory.reduce((s, b) => s + b.chapters_read, 0)
    const total = sumChapters(booksInCategory)
    return { cat, read: catRead, total, pct: total > 0 ? Math.min(Math.round((catRead / total) * 100), 100) : 0 }
  }), [books])

  const weekChapters = stats?.chapters_this_week ?? 0
  const atGoal = weekChapters >= weeklyGoal

  useEffect(() => {
    if (books.length === 0) return
    const end = overallPct
    const startTime = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / 1000, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayPct(Math.round(end * eased))
      if (t < 1) animFrameRef.current = requestAnimationFrame(animate)
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [overallPct, books.length])

  const saveGoal = async (val: string) => {
    const n = parseInt(val, 10)
    if (isNaN(n) || n <= 0 || n > 200) {
      setGoalError('Enter a number between 1 and 200.')
      return
    }
    setGoalError(null)
    setEditingGoal(false)
    // The mutation writes the new goal into the dashboard cache before the request
    // goes out and rolls it back itself on failure, so there's nothing to undo here.
    const saved = await saveWeeklyGoal(n)
    if (!saved) setGoalError("Couldn't save your goal — please try again.")
  }

  const firstName = user?.name?.split(' ')[0] ?? 'friend'

  const { primaryText, dimText, bodyText, trackBg } = colors
  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      {/* Hero */}
      <div className="px-5 py-10 md:py-14">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-14">

          {/* Ring */}
          <div className="relative shrink-0" style={fadeUp(0)}>
            {isInitialLoading ? (
              <Skeleton rounded="rounded-full" style={{ width: 180, height: 180 }} />
            ) : (
              <>
                <CircularProgress
                  value={totalRead}
                  max={TOTAL_CHAPTERS}
                  size={180}
                  trackClassName={isDark ? 'text-white/10' : 'text-[#0d1533]/12'}
                  arcClassName={isDark ? 'text-[#aabfff] transition-all duration-700 ease-out' : 'text-[#0d1533]/75 transition-all duration-700 ease-out'}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="font-cinzel text-5xl md:text-6xl font-bold leading-none tabular-nums"
                    style={{ color: primaryText }}
                  >
                    {displayPct}%
                  </span>
                  <span className="text-[11px] mt-1.5 uppercase tracking-widest" style={{ color: dimText }}>complete</span>
                </div>
              </>
            )}
          </div>

          {/* Hero text */}
          <div className="flex flex-col gap-3 text-center md:text-left" style={fadeUp(80)}>
            <p className="text-sm tracking-wide" style={{ color: dimText }}>{formatDate()}</p>
            <h1
              className="font-cinzel text-3xl md:text-4xl font-semibold leading-tight"
              style={{ color: primaryText, letterSpacing: '0.04em' }}
            >
              {getGreeting()},<br />{firstName}.
            </h1>
            {isInitialLoading ? (
              <Skeleton className="h-5 w-64 max-w-full self-center md:self-start" />
            ) : (
              <p className="text-sm" style={{ color: bodyText }}>
                <span className="font-semibold" style={{ color: primaryText }}>{totalRead.toLocaleString()}</span> of{' '}
                <span className="font-semibold" style={{ color: primaryText }}>{TOTAL_CHAPTERS.toLocaleString()}</span> chapters ·{' '}
                <span className="font-semibold" style={{ color: primaryText }}>{booksComplete}</span> of {TOTAL_BOOKS} books complete
              </p>
            )}
            <div className="flex gap-3 flex-wrap justify-center md:justify-start mt-1">
              {isInitialLoading ? (
                <>
                  <Skeleton rounded="rounded-full" className="h-8 w-28" />
                  <Skeleton rounded="rounded-full" className="h-8 w-24" />
                </>
              ) : [
                { icon: <FlameIcon size={14} />, label: `${stats?.current_streak ?? 0}d streak` },
                { icon: <CalendarIcon size={14} />, label: `${stats?.chapters_today ?? 0} today` },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
                  style={{
                    background: isDark ? 'rgba(150,175,255,0.12)' : 'rgba(255,255,255,0.65)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: isDark ? '1px solid rgba(150,175,255,0.2)' : '1px solid rgba(100,130,255,0.2)',
                  }}
                >
                  <span style={{ color: isDark ? 'rgba(200,185,110,0.9)' : 'rgba(140,100,20,0.8)' }}>{icon}</span>
                  <span className="text-sm font-semibold" style={{ color: primaryText }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Row 1: Weekly goal + Continue reading */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Weekly goal */}
          <div className="glass-card p-5" style={fadeUp(160)}>
            <div className="flex items-center justify-between mb-4">
              <span className="section-label">Weekly Goal</span>
              {!editingGoal && !isInitialLoading && (
                <button
                  onClick={() => { setGoalInput(String(weeklyGoal)); setGoalError(null); setEditingGoal(true) }}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: dimText }}
                  title="Edit goal"
                  aria-label="Edit weekly goal"
                >
                  <PencilIcon size={14} />
                </button>
              )}
            </div>

            {isInitialLoading ? (
              <div className="mb-4">
                <Skeleton className="h-9 w-32" />
              </div>
            ) : editingGoal ? (
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={200}
                    value={goalInput}
                    onChange={e => { setGoalInput(e.target.value); setGoalError(null) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveGoal(goalInput)
                      if (e.key === 'Escape') { setGoalError(null); setEditingGoal(false) }
                    }}
                    autoFocus
                    className="w-20 px-2 py-1 rounded-lg outline-none text-sm"
                    style={{
                      background: isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.06)',
                      border: goalError ? '1px solid rgba(240,100,100,0.6)' : '1px solid rgba(150,175,255,0.25)',
                      color: primaryText,
                    }}
                  />
                  <span className="text-sm" style={{ color: dimText }}>chapters / week</span>
                  <button
                    onClick={() => saveGoal(goalInput)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                    style={{ background: 'rgba(150,175,255,0.18)', color: primaryText }}
                  >
                    Save
                  </button>
                </div>
                {goalError && (
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(240,100,100,0.8)' }} role="alert">
                    {goalError}
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-cinzel text-4xl font-bold tabular-nums" style={{ color: primaryText }}>
                    {weekChapters}
                  </span>
                  <span className="text-sm" style={{ color: dimText }}>
                    / {weeklyGoal} chapters this week
                  </span>
                </div>
                {goalError && (
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(240,100,100,0.8)' }} role="alert">
                    {goalError}
                  </p>
                )}
              </div>
            )}

            {isInitialLoading ? (
              <Skeleton className="h-2" />
            ) : (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: trackBg }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min((weekChapters / weeklyGoal) * 100, 100)}%`,
                    background: atGoal
                      ? 'linear-gradient(90deg, rgba(80,200,140,0.85), rgba(100,225,165,0.9))'
                      : 'linear-gradient(90deg, rgba(200,180,80,0.75), rgba(230,200,80,0.85))',
                  }}
                />
              </div>
            )}
            {!isInitialLoading && (
              <p className="text-xs mt-2" style={{ color: dimText }}>
                {atGoal
                  ? `Goal reached!${weekChapters - weeklyGoal > 0 ? ` +${weekChapters - weeklyGoal} bonus` : ''}`
                  : `${weeklyGoal - weekChapters} more to reach your goal`}
              </p>
            )}
          </div>

          {/* Continue reading */}
          <div className="glass-card p-5" style={fadeUp(210)}>
            <span className="section-label block mb-3">Continue Reading</span>
            {continueBooks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {continueBooks.map(book => (
                  <BookCard
                    key={book.name}
                    book={book}
                    variant="row"
                    onClick={() => navigate('/tracker', { state: { selectBook: book.name } })}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <span style={{ color: dimText }}><BookOpenIcon size={32} /></span>
                <p className="text-sm text-center" style={{ color: dimText }}>Start reading to see books here</p>
                <button
                  onClick={() => navigate('/tracker')}
                  className="text-xs font-medium hover:underline mt-1"
                  style={{ color: isDark ? 'rgba(170,195,255,0.7)' : 'rgba(13,21,51,0.55)' }}
                >
                  Open Tracker →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Testament breakdown */}
        <div className="glass-card p-5" style={fadeUp(260)}>
          <span className="section-label block mb-4">Testament Progress</span>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Old Testament', read: otRead, total: otTotal, color: 'rgba(240,180,60,0.85)' },
              { label: 'New Testament', read: ntRead, total: ntTotal, color: 'rgba(170,120,255,0.85)' },
            ].map(({ label, read, total, color }) => {
              const pct = total > 0 ? Math.round((read / total) * 100) : 0
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium" style={{ color: primaryText }}>{label}</span>
                    <span className="tabular-nums text-xs" style={{ color: dimText }}>
                      {read.toLocaleString()} / {total.toLocaleString()} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: trackBg }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="glass-card p-5" style={fadeUp(310)}>
          <span className="section-label block mb-4">Category Progress</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {categoryProgress.map(({ cat, read, total, pct }) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0" style={{ color: dimText }}>
                      <CategoryIcon category={cat} size={13} />
                    </span>
                    <span className="text-xs font-medium truncate" style={{ color: bodyText }}>{cat}</span>
                  </div>
                  <span className="text-xs shrink-0 ml-2 tabular-nums" style={{ color: dimText }}>{read}/{total}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: getCategoryPalette(cat).color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity heatmap */}
        <div className="glass-card p-5" style={fadeUp(360)}>
          <span className="section-label block mb-4">Reading Activity</span>
          <ActivityHeatmap activity={activity ?? []} />
        </div>

        {/* Reading Rhythm */}
        <div style={fadeUp(410)}>
          <ReadingRhythm />
        </div>
      </div>

      <footer className="text-center text-sm py-3" style={{ color: dimText, ...fadeUp(460) }}>
        Made by Terrance Huang
      </footer>
    </div>
  )
}
