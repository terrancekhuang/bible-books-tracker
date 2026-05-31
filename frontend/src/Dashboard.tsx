import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { authHeaders } from './lib/auth'
import { flushQueue } from './lib/offlineQueue'
import { getCache, setCache } from './lib/cache'
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

const CATEGORY_BAR_COLORS: Record<string, string> = {
  'Law':             'rgba(240,170,60,0.82)',
  'History':         'rgba(80,200,140,0.82)',
  'Poetry':          'rgba(170,120,255,0.82)',
  'Major Prophets':  'rgba(240,120,60,0.82)',
  'Minor Prophets':  'rgba(240,210,60,0.82)',
  'Gospels':         'rgba(240,80,100,0.82)',
  'Church History':  'rgba(60,175,230,0.82)',
  "Paul's Epistles": 'rgba(100,130,255,0.82)',
  'General Epistles':'rgba(60,200,185,0.82)',
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
  const [weeklyGoal, setWeeklyGoal] = useState<number>(7)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const animFrameRef = useRef<number | null>(null)
  const navigate = useNavigate()
  const isDark = theme === 'dark'

  useEffect(() => {
    const cachedBooks = getCache<Book[]>('books')
    if (cachedBooks) setBooks(cachedBooks.map(b => ({ ...b, chapters_read_list: b.chapters_read_list ?? [], last_read_at: b.last_read_at ?? null })))
    const cachedStats = getCache<Stats>('stats')
    if (cachedStats) setStats(cachedStats)
    const cachedActivity = getCache<ActivityDay[]>('activity')
    if (cachedActivity) setActivity(cachedActivity)
    const cachedUser = getCache<UserInfo>('user')
    if (cachedUser) setUser(cachedUser)

    const fetchAll = () => {
      const headers = authHeaders()
      return Promise.all([
        fetch('/api/books', { headers }).then(r => { if (r.status === 401) { onLogout(); return null } return r.json() }),
        fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, { headers }).then(r => { if (r.status === 401) { onLogout(); return null } return r.ok ? r.json() : null }),
        fetch(`/api/activity?tz_offset=${-new Date().getTimezoneOffset()}`, { headers }).then(r => { if (r.status === 401) { onLogout(); return [] } return r.ok ? r.json() : [] }),
        fetch('/auth/me', { headers }).then(r => { if (r.status === 401) { onLogout(); return null } return r.ok ? r.json() : null }),
        fetch('/api/settings', { headers }).then(r => r.ok ? r.json() : null),
      ]).then(([booksData, statsData, activityData, userData, settingsData]) => {
        if (booksData) {
          const mapped = booksData.map((b: Book) => ({
            ...b,
            chapters_read_list: b.chapters_read_list ?? [],
            last_read_at: b.last_read_at ?? null,
          }))
          setBooks(mapped)
          setCache('books', mapped)
        }
        if (statsData) { setStats(statsData); setCache('stats', statsData) }
        if (activityData) { setActivity(activityData); setCache('activity', activityData) }
        if (userData) { setUser(userData); setCache('user', userData) }
        if (settingsData?.weekly_goal) setWeeklyGoal(settingsData.weekly_goal)
      })
    }

    const run = () => navigator.onLine ? flushQueue(onLogout).then(fetchAll) : fetchAll()
    run()

    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [onLogout])

  const totalRead = books.reduce((s, b) => s + b.chapters_read, 0)
  const overallPct = Math.round((totalRead / TOTAL_CHAPTERS) * 100)
  const booksComplete = books.filter(b => b.chapters_read >= b.num_chapters).length

  const continueBooks = books
    .filter(b => b.chapters_read > 0 && b.chapters_read < b.num_chapters)
    .sort((a, b) => {
      if (!a.last_read_at && !b.last_read_at) return 0
      if (!a.last_read_at) return 1
      if (!b.last_read_at) return -1
      return b.last_read_at.localeCompare(a.last_read_at)
    })
    .slice(0, 3)

  const otRead = books.filter(b => b.testament === 'Old Testament').reduce((s, b) => s + b.chapters_read, 0)
  const ntRead = books.filter(b => b.testament === 'New Testament').reduce((s, b) => s + b.chapters_read, 0)

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
      const prev = weeklyGoal
      setWeeklyGoal(n)
      fetch('/api/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ weekly_goal: n }),
      })
        .then(r => { if (!r.ok) setWeeklyGoal(prev) })
        .catch(() => setWeeklyGoal(prev))
    }
    setEditingGoal(false)
  }

  const firstName = user?.name?.split(' ')[0] ?? 'friend'

  const primaryText = isDark ? '#dde6ff' : '#0d1533'
  const dimText = isDark ? 'rgba(195,210,255,0.72)' : 'rgba(13,21,51,0.55)'
  const bodyText = isDark ? 'rgba(195,210,255,0.9)' : 'rgba(13,21,51,0.78)'
  const trackBg = isDark ? 'rgba(150,175,255,0.12)' : 'rgba(13,21,51,0.1)'
  const secLabel: CSSProperties = {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color: isDark ? 'rgba(150,175,255,0.65)' : 'rgba(13,21,51,0.5)',
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      <NavBar theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} pictureUrl={user?.picture_url} userName={user?.name} />

      {/* Hero */}
      <div className="px-5 py-10 md:py-14">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-14">

          {/* Ring */}
          <div className="relative shrink-0" style={fadeUp(0)}>
            <CircularProgress
              value={totalRead}
              max={TOTAL_CHAPTERS}
              size={180}
              trackClassName={isDark ? 'text-white/10' : 'text-[#0d1533]/12'}
              arcClassName={isDark ? 'text-[#aabfff] transition-all duration-700 ease-out' : 'text-[#0d1533]/75 transition-all duration-700 ease-out'}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-5xl md:text-6xl font-bold leading-none tabular-nums"
                style={{ fontFamily: "'Cinzel', serif", color: primaryText }}
              >
                {displayPct}%
              </span>
              <span className="text-[11px] mt-1.5 uppercase tracking-widest" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>complete</span>
            </div>
          </div>

          {/* Hero text */}
          <div className="flex flex-col gap-3 text-center md:text-left" style={fadeUp(80)}>
            <p className="text-sm tracking-wide" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>{formatDate()}</p>
            <h1
              className="text-3xl md:text-4xl font-semibold leading-tight"
              style={{ fontFamily: "'Cinzel', serif", color: primaryText, letterSpacing: '0.04em' }}
            >
              {getGreeting()},<br />{firstName}.
            </h1>
            <p className="text-sm" style={{ color: bodyText, fontFamily: "'Raleway', sans-serif" }}>
              <span className="font-semibold" style={{ color: primaryText }}>{totalRead.toLocaleString()}</span> of{' '}
              <span className="font-semibold" style={{ color: primaryText }}>{TOTAL_CHAPTERS.toLocaleString()}</span> chapters ·{' '}
              <span className="font-semibold" style={{ color: primaryText }}>{booksComplete}</span> of {TOTAL_BOOKS} books complete
            </p>
            <div className="flex gap-3 flex-wrap justify-center md:justify-start mt-1">
              {[
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
                  <span className="text-sm font-semibold" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>{label}</span>
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
              <span style={secLabel}>Weekly Goal</span>
              {!editingGoal && (
                <button
                  onClick={() => { setGoalInput(String(weeklyGoal)); setEditingGoal(true) }}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: dimText }}
                  title="Edit goal"
                >
                  <PencilIcon size={14} />
                </button>
              )}
            </div>

            {editingGoal ? (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number" min={1} max={200}
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onBlur={() => saveGoal(goalInput)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveGoal(goalInput)
                    if (e.key === 'Escape') setEditingGoal(false)
                  }}
                  autoFocus
                  className="w-20 px-2 py-1 rounded-lg outline-none text-sm"
                  style={{
                    background: isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.06)',
                    border: '1px solid rgba(150,175,255,0.25)',
                    color: primaryText,
                    fontFamily: "'Raleway', sans-serif",
                  }}
                />
                <span className="text-sm" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>chapters / week</span>
                <button
                  onClick={() => saveGoal(goalInput)}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                  style={{ background: 'rgba(150,175,255,0.18)', color: isDark ? '#dde6ff' : '#0d1533', fontFamily: "'Raleway', sans-serif" }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-4xl font-bold tabular-nums" style={{ fontFamily: "'Cinzel', serif", color: primaryText }}>
                  {weekChapters}
                </span>
                <span className="text-sm" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                  / {weeklyGoal} chapters this week
                </span>
              </div>
            )}

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
            <p className="text-xs mt-2" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
              {atGoal
                ? `Goal reached!${weekChapters - weeklyGoal > 0 ? ` +${weekChapters - weeklyGoal} bonus` : ''}`
                : `${weeklyGoal - weekChapters} more to reach your goal`}
            </p>
          </div>

          {/* Continue reading */}
          <div className="glass-card p-5" style={fadeUp(210)}>
            <span style={secLabel} className="block mb-3">Continue Reading</span>
            {continueBooks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {continueBooks.map(book => {
                  const pct = Math.round((book.chapters_read / book.num_chapters) * 100)
                  return (
                    <button
                      key={book.name}
                      onClick={() => navigate('/tracker', { state: { selectBook: book.name } })}
                      className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all group"
                      style={{
                        background: isDark ? 'rgba(150,175,255,0.06)' : 'rgba(100,130,255,0.06)',
                        border: isDark ? '1px solid rgba(150,175,255,0.12)' : '1px solid rgba(100,130,255,0.12)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(150,175,255,0.12)' : 'rgba(13,21,51,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isDark ? 'rgba(150,175,255,0.06)' : 'rgba(100,130,255,0.06)')}
                    >
                      <div className="shrink-0" style={{ color: isDark ? 'rgba(170,195,255,0.65)' : 'rgba(13,21,51,0.45)' }}>
                        <CategoryIcon category={book.category} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>{book.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                          {book.chapters_read} / {book.num_chapters} ch · {pct}%
                        </p>
                      </div>
                      <span className="transition-colors" style={{ color: dimText }}>→</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <span style={{ color: dimText }}><BookOpenIcon size={32} /></span>
                <p className="text-sm text-center" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>Start reading to see books here</p>
                <button
                  onClick={() => navigate('/tracker')}
                  className="text-xs font-medium hover:underline mt-1"
                  style={{ color: isDark ? 'rgba(170,195,255,0.7)' : 'rgba(13,21,51,0.55)', fontFamily: "'Raleway', sans-serif" }}
                >
                  Open Tracker →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Testament breakdown */}
        <div className="glass-card p-5" style={fadeUp(260)}>
          <span style={secLabel} className="block mb-4">Testament Progress</span>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Old Testament', read: otRead, total: OT_CHAPTERS, color: 'rgba(240,180,60,0.85)' },
              { label: 'New Testament', read: ntRead, total: NT_CHAPTERS, color: 'rgba(170,120,255,0.85)' },
            ].map(({ label, read, total, color }) => {
              const pct = Math.round((read / total) * 100)
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>{label}</span>
                    <span className="tabular-nums text-xs" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
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
          <span style={secLabel} className="block mb-4">Category Progress</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {categoryProgress.map(({ cat, read, total, pct }) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0" style={{ color: dimText }}>
                      <CategoryIcon category={cat} size={13} />
                    </span>
                    <span className="text-xs font-medium truncate" style={{ color: bodyText, fontFamily: "'Raleway', sans-serif" }}>{cat}</span>
                  </div>
                  <span className="text-xs shrink-0 ml-2 tabular-nums" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>{read}/{total}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: CATEGORY_BAR_COLORS[cat] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity heatmap */}
        <div className="glass-card p-5" style={fadeUp(360)}>
          <span style={secLabel} className="block mb-4">Reading Activity</span>
          <ActivityHeatmap activity={activity} />
        </div>
      </div>

      <footer className="text-center text-sm py-3" style={{ color: dimText, ...fadeUp(410) }}>
        Made by Terrance Huang
      </footer>
    </div>
  )
}
