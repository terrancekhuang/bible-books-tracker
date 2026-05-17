import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { authHeaders } from './lib/auth'
import { FlameIcon, CalendarIcon, CategoryIcon, PencilIcon, BookOpenIcon } from './components/Icons'
import ActivityHeatmap, { type ActivityDay } from './components/ActivityHeatmap'
import CircularProgress from './components/CircularProgress'
import NavBar from './components/NavBar'

interface Book {
  book_id: number
  name: string
  testament: string
  category: string
  num_chapters: number
  chapters_read: number
  chapters_read_list: number[]
  last_read_at: string | null
}

interface Stats {
  chapters_today: number
  chapters_this_week: number
  current_streak: number
  best_streak: number
  total_chapters: number
  total_days: number
}

interface UserInfo {
  name: string | null
  picture_url: string | null
}

const TOTAL_CHAPTERS = 1189
const TOTAL_BOOKS = 66
const OT_CHAPTERS = 929
const NT_CHAPTERS = 260

const CATEGORY_ORDER = [
  'Law', 'History', 'Poetry', 'Major Prophets', 'Minor Prophets',
  'Gospels', 'Church History', "Paul's Epistles", 'General Epistles',
]

const CATEGORY_TOTALS: Record<string, number> = {
  'Law': 187, 'History': 249, 'Poetry': 243,
  'Major Prophets': 183, 'Minor Prophets': 67,
  'Gospels': 89, 'Church History': 28,
  "Paul's Epistles": 87, 'General Epistles': 56,
}

const CATEGORY_COLORS: Record<string, string> = {
  'Law': 'bg-amber-500',
  'History': 'bg-emerald-500',
  'Poetry': 'bg-violet-500',
  'Major Prophets': 'bg-orange-500',
  'Minor Prophets': 'bg-yellow-500',
  'Gospels': 'bg-rose-500',
  'Church History': 'bg-sky-500',
  "Paul's Epistles": 'bg-indigo-500',
  'General Epistles': 'bg-teal-500',
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

const section = (delay: number): CSSProperties => ({
  animation: 'fade-slide-up 0.5s ease-out both',
  animationDelay: `${delay}ms`,
})

export default function Dashboard({
  onLogout,
  theme,
  onToggleTheme,
}: {
  onLogout: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const [books, setBooks] = useState<Book[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [user, setUser] = useState<UserInfo | null>(null)
  const [displayPct, setDisplayPct] = useState(0)
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('weekly_reading_goal')
    return saved ? Math.max(1, parseInt(saved, 10)) : 7
  })
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const animFrameRef = useRef<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const headers = authHeaders()
    Promise.all([
      fetch('/api/books', { headers }).then(r => { if (r.status === 401) { onLogout(); return null } return r.json() }),
      fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, { headers }).then(r => r.ok ? r.json() : null),
      fetch('/api/activity', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/auth/me', { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([booksData, statsData, activityData, userData]) => {
      if (booksData) {
        setBooks(booksData.map((b: Book) => ({
          ...b,
          chapters_read_list: b.chapters_read_list ?? [],
          last_read_at: b.last_read_at ?? null,
        })))
      }
      if (statsData) setStats(statsData)
      if (activityData) setActivity(activityData)
      if (userData) setUser(userData)
    })
  }, [])

  const totalRead = books.reduce((s, b) => s + b.chapters_read, 0)
  const overallPct = Math.round((totalRead / TOTAL_CHAPTERS) * 100)
  const booksComplete = books.filter(b => b.chapters_read >= b.num_chapters).length

  const continueBooks = books
    .filter(b => b.chapters_read > 0 && b.chapters_read < b.num_chapters)
    .sort((a, b) => (b.last_read_at ?? '').localeCompare(a.last_read_at ?? ''))
    .slice(0, 3)

  const otRead = books
    .filter(b => b.testament === 'Old Testament')
    .reduce((s, b) => s + b.chapters_read, 0)
  const ntRead = books
    .filter(b => b.testament === 'New Testament')
    .reduce((s, b) => s + b.chapters_read, 0)

  const categoryProgress = CATEGORY_ORDER.map(cat => {
    const catRead = books.filter(b => b.category === cat).reduce((s, b) => s + b.chapters_read, 0)
    const total = CATEGORY_TOTALS[cat]
    return { cat, read: catRead, total, pct: total > 0 ? Math.min(Math.round((catRead / total) * 100), 100) : 0 }
  })

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

  const saveGoal = (val: string) => {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) {
      setWeeklyGoal(n)
      localStorage.setItem('weekly_reading_goal', String(n))
    }
    setEditingGoal(false)
  }

  const firstName = user?.name?.split(' ')[0] ?? 'friend'

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-0">
      <NavBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        pictureUrl={user?.picture_url}
        userName={user?.name}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-5 py-10 md:py-14">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-14">

          {/* Ring */}
          <div
            className="relative shrink-0"
            style={{ animation: 'fade-slide-up 0.6s ease-out both', animationDelay: '0ms' }}
          >
            <CircularProgress
              value={totalRead}
              max={TOTAL_CHAPTERS}
              size={180}
              trackClassName="text-white/20"
              arcClassName="text-white transition-all duration-700 ease-out"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-5xl md:text-6xl font-bold text-white leading-none tabular-nums"
                style={{ fontFamily: "'Lora', Georgia, serif" }}
              >
                {displayPct}%
              </span>
              <span className="text-[11px] text-white/50 mt-1.5 uppercase tracking-widest">complete</span>
            </div>
          </div>

          {/* Hero text */}
          <div
            className="flex flex-col gap-3 text-center md:text-left"
            style={{ animation: 'fade-slide-up 0.6s ease-out both', animationDelay: '80ms' }}
          >
            <p className="text-sm text-white/50 tracking-wide">{formatDate()}</p>
            <h1
              className="text-3xl md:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              {getGreeting()},<br />{firstName}.
            </h1>
            <p className="text-white/70 text-sm">
              <span className="font-semibold text-white">{totalRead.toLocaleString()}</span> of{' '}
              <span className="font-semibold text-white">{TOTAL_CHAPTERS.toLocaleString()}</span> chapters ·{' '}
              <span className="font-semibold text-white">{booksComplete}</span> of {TOTAL_BOOKS} books complete
            </p>
            <div className="flex gap-3 flex-wrap justify-center md:justify-start mt-1">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3.5 py-1.5 rounded-full">
                <FlameIcon size={14} />
                <span className="text-sm font-semibold text-white">{stats?.current_streak ?? 0}d streak</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3.5 py-1.5 rounded-full">
                <CalendarIcon size={14} />
                <span className="text-sm font-semibold text-white">{stats?.chapters_today ?? 0} today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body sections */}
      <div className="max-w-4xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Row 1: Weekly goal + Continue reading */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Weekly goal */}
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"
            style={section(160)}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Weekly Goal
              </h2>
              {!editingGoal && (
                <button
                  onClick={() => { setGoalInput(String(weeklyGoal)); setEditingGoal(true) }}
                  className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  title="Edit goal"
                >
                  <PencilIcon size={14} />
                </button>
              )}
            </div>

            {editingGoal ? (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onBlur={() => saveGoal(goalInput)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveGoal(goalInput)
                    if (e.key === 'Escape') setEditingGoal(false)
                  }}
                  autoFocus
                  className="w-20 px-2 py-1 rounded-lg border border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 outline-none text-slate-900 dark:text-slate-100 dark:bg-slate-700 text-sm"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">chapters / week</span>
                <button
                  onClick={() => saveGoal(goalInput)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {weekChapters}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-sm">
                  / {weeklyGoal} chapters this week
                </span>
              </div>
            )}

            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${atGoal ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.min((weekChapters / weeklyGoal) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs mt-2 text-slate-400 dark:text-slate-500">
              {atGoal
                ? `Goal reached!${weekChapters - weeklyGoal > 0 ? ` +${weekChapters - weeklyGoal} bonus` : ''}`
                : `${weeklyGoal - weekChapters} more to reach your goal`}
            </p>
          </div>

          {/* Continue reading */}
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"
            style={section(210)}
          >
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Continue Reading
            </h2>
            {continueBooks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {continueBooks.map(book => {
                  const pct = Math.round((book.chapters_read / book.num_chapters) * 100)
                  return (
                    <button
                      key={book.name}
                      onClick={() => navigate('/tracker', { state: { selectBook: book.name } })}
                      className="w-full flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3 text-left hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors group"
                    >
                      <div className="text-indigo-500 dark:text-indigo-400 shrink-0">
                        <CategoryIcon category={book.category} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                          {book.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {book.chapters_read} / {book.num_chapters} ch · {pct}%
                        </p>
                      </div>
                      <span className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 transition-colors">
                        →
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500 gap-2">
                <BookOpenIcon size={32} />
                <p className="text-sm text-center">Start reading to see books here</p>
                <button
                  onClick={() => navigate('/tracker')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                >
                  Open Tracker →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Testament breakdown */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"
          style={section(260)}
        >
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
            Testament Progress
          </h2>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Old Testament', read: otRead, total: OT_CHAPTERS, color: 'bg-amber-500' },
              { label: 'New Testament', read: ntRead, total: NT_CHAPTERS, color: 'bg-violet-500' },
            ].map(({ label, read, total, color }) => {
              const pct = Math.round((read / total) * 100)
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="text-slate-400 dark:text-slate-500 tabular-nums text-xs">
                      {read.toLocaleString()} / {total.toLocaleString()} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category breakdown */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"
          style={section(310)}
        >
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
            Category Progress
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {categoryProgress.map(({ cat, read, total, pct }) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">
                      <CategoryIcon category={cat} size={13} />
                    </span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{cat}</span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2 tabular-nums">
                    {read}/{total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[cat]} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity heatmap */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5"
          style={section(360)}
        >
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
            Reading Activity
          </h2>
          <ActivityHeatmap activity={activity} />
        </div>
      </div>
    </div>
  )
}
