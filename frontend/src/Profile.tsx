import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UserInfo {
  user_id: number
  email: string
  name: string | null
  picture_url: string | null
}

interface Cycle {
  cycle_id: number
  cycle_number: number
  chapters_read: number
  total_chapters: number
  books_complete: number
}

interface ActivityDay {
  logged_at: string
  chapters: number
}

interface Stats {
  total_chapters: number
  total_days: number
  best_streak: number
  current_streak: number
  chapters_today: number
  chapters_this_week: number
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('app_jwt')
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

const TOTAL_BOOKS = 66
const TOTAL_CHAPTERS = 1189

function intensityClass(chapters: number): string {
  if (chapters === 0) return 'bg-slate-100 dark:bg-slate-700'
  if (chapters <= 2) return 'bg-indigo-200 dark:bg-indigo-800'
  if (chapters <= 5) return 'bg-indigo-400 dark:bg-indigo-600'
  if (chapters <= 10) return 'bg-indigo-600'
  return 'bg-indigo-800'
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const chaptersByDate = new Map<string, number>()
  for (const d of activity) {
    const dt = new Date(d.logged_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
    chaptersByDate.set(key, (chaptersByDate.get(key) ?? 0) + d.chapters)
  }

  // Build 52 full weeks ending today, starting from the most recent Sunday >= 364 days ago
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - 51 * 7)

  const weeks: Array<Array<{ dateStr: string; label: string; chapters: number; isFuture: boolean }>> = []
  const cursor = new Date(start)

  while (cursor <= new Date(today.getTime() + 7 * 86400000)) {
    if (weeks.length >= 53) break
    const week = []
    for (let d = 0; d < 7; d++) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      week.push({
        dateStr,
        label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        chapters: chaptersByDate.get(dateStr) ?? 0,
        isFuture: cursor > today,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  // Month labels: show abbreviated month on first week that contains a month's 1st
  const monthLabels = weeks.map(week => {
    const d = new Date(week[0].dateStr + 'T00:00:00')
    return d.getDate() <= 7 ? d.toLocaleString('en-US', { month: 'short' }) : ''
  })

  return (
    <div className="w-full flex flex-col" style={{ gap: 2 }}>
      {/* Month labels aligned to week columns */}
      <div className="flex" style={{ gap: 2 }}>
        <div style={{ width: 20, flexShrink: 0 }} />
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 2 }}
        >
          {monthLabels.map((label, i) => (
            <div key={i} className="text-xs text-slate-400 dark:text-slate-500 overflow-visible whitespace-nowrap">
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Day labels + week grid */}
      <div className="flex" style={{ gap: 2 }}>
        <div className="flex flex-col justify-around shrink-0" style={{ width: 16, marginRight: 4 }}>
          {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
            <div key={i} className="text-xs text-slate-400 dark:text-slate-500 text-right">{d}</div>
          ))}
        </div>
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 2 }}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-full aspect-square rounded-sm ${
                    day.isFuture ? '' : intensityClass(day.chapters)
                  }`}
                  title={day.isFuture ? '' : `${day.label}: ${day.chapters} chapter${day.chapters !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-1 self-end">
        <span className="text-xs text-slate-400 dark:text-slate-500">Less</span>
        {['bg-slate-100 dark:bg-slate-700', 'bg-indigo-200 dark:bg-indigo-800', 'bg-indigo-400 dark:bg-indigo-600', 'bg-indigo-600', 'bg-indigo-800'].map((cls, i) => (
          <div key={i} className={`rounded-sm ${cls}`} style={{ width: 12, height: 12 }} />
        ))}
        <span className="text-xs text-slate-400 dark:text-slate-500">More</span>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

export default function Profile({ onLogout, theme, onToggleTheme }: { onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const headers = authHeaders()
    Promise.all([
      fetch('/auth/me',       { headers }).then(r => { if (r.status === 401) { onLogout(); return null } return r.json() }),
      fetch('/api/cycles',    { headers }).then(r => { if (r.status === 401) { onLogout(); return null } return r.json() }),
      fetch('/api/activity',  { headers }).then(r => r.ok ? r.json() : []),
      fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([userData, cyclesData, activityData, statsData]) => {
      if (userData)   setUser(userData)
      if (cyclesData) setCycles(cyclesData)
      if (activityData) setActivity(activityData)
      if (statsData)  setStats(statsData)
    })
  }, [])

  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null
  const pastCycles   = cycles.slice(0, -1)

  const handleNewCycle = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/cycles', { method: 'POST', headers: authHeaders() })
      if (res.status === 401) { onLogout(); return }
      if (!res.ok) throw new Error('Failed to create cycle')
      dialogRef.current?.close()
      navigate('/')
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => navigate('/')}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">Profile</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              onClick={onLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 py-5 max-w-3xl mx-auto w-full">
        {/* User info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
          {user?.picture_url ? (
            <img src={user.picture_url} alt="avatar" className="w-14 h-14 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {user?.name?.[0] ?? '?'}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{user?.name ?? '—'}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">{user?.email ?? '—'}</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Today"          value={stats?.chapters_today ?? 0} />
          <StatCard label="This Week"      value={stats?.chapters_this_week ?? 0} />
          <StatCard label="Current Streak" value={`${stats?.current_streak ?? 0}d`} />
          <StatCard label="Best Streak"    value={`${stats?.best_streak ?? 0}d`} />
          <StatCard label="Total Chapters" value={stats?.total_chapters ?? 0} />
          <StatCard label="Reading Days"   value={stats?.total_days ?? 0} />
        </div>

        {/* Activity heatmap */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Reading Activity</h2>
          <ActivityHeatmap activity={activity} />
        </div>

        {/* Current cycle */}
        {currentCycle && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Current Cycle — #{currentCycle.cycle_number}
            </h2>
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Chapters</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {currentCycle.chapters_read} / {TOTAL_CHAPTERS}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round((currentCycle.chapters_read / TOTAL_CHAPTERS) * 100)}%` }}
              />
            </div>
            <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{Math.round((currentCycle.chapters_read / TOTAL_CHAPTERS) * 100)}% complete</span>
              <span>{currentCycle.books_complete} / {TOTAL_BOOKS} books</span>
            </div>
          </div>
        )}

        {/* Start New Cycle */}
        <div>
          <button
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            onClick={() => dialogRef.current?.showModal()}
          >
            Start New Cycle
          </button>
        </div>

        {/* Past cycles */}
        {pastCycles.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Cycle History</h2>
            <div className="flex flex-col gap-2">
              {pastCycles.map(cycle => {
                const pct = Math.round((cycle.chapters_read / TOTAL_CHAPTERS) * 100)
                return (
                  <div key={cycle.cycle_id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Cycle {cycle.cycle_number}</span>
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      {pct}% · {cycle.chapters_read} chapters · {cycle.books_complete} books
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box rounded-2xl dark:bg-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Start a new cycle?</h3>
          <p className="py-4 text-sm text-slate-600 dark:text-slate-300">
            Starting a new cycle resets your reading progress. Your current cycle's progress is saved in history.
          </p>
          <div className="modal-action">
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
              onClick={handleNewCycle}
              disabled={creating}
            >
              {creating ? 'Creating…' : 'Start New Cycle'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  )
}
