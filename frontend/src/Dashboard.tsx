import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBooksQuery, useDashboardQuery } from './lib/queries'
import { useUpdateWeeklyGoal } from './lib/useDashboardMutations'
import { FlameIcon, CalendarIcon, CategoryIcon, PencilIcon, BookOpenIcon } from './components/Icons'
import Skeleton from './components/Skeleton'
import ActivityHeatmap from './components/ActivityHeatmap'
import DashboardEntryRow from './components/DashboardEntryRow'
import LeafDivider from './components/LeafDivider'
import LeafSectionLabel from './components/LeafSectionLabel'
import LeafMarginaliaItem from './components/LeafMarginaliaItem'
import NavBar from './components/NavBar'
import ReadingRhythm from './components/ReadingRhythm'
import { TOTAL_CHAPTERS, TOTAL_BOOKS, calculateOverallProgress, calculateProgress, type Book } from './lib/trackerLogic'
import { CATEGORY_ORDER, CLOTH, GILT } from './lib/volumesTokens'
import { leafSurfaceStyle } from './lib/leafSurface'

const primaryText = 'var(--color-ink)'
const dimText = 'rgba(35,31,26,0.55)'
const trackBg = 'rgba(35,31,26,0.1)'

// The Old/New Testament rows aren't a "volume" with a single cloth colour of their own —
// they lean on the leaf's other two accents instead: the red rule for the Old Testament,
// gilt for the New.
const TESTAMENT_RULE: Record<string, string> = {
  'Old Testament': 'var(--color-leaf-red)',
  'New Testament': GILT,
}

// There's no single volume backing the whole Dashboard, so the leaf's ornamental top edge
// is gilt rather than a cloth colour.
const LEAF_STYLE: CSSProperties = {
  padding: 'clamp(24px, 4vw, 52px)',
  ...leafSurfaceStyle(GILT),
}

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
  const navigate = useNavigate()

  const { data: books = [], isLoading: booksLoading, isError: booksError, refetch: refetchBooks } = useBooksQuery()
  const { data: dashboard, isLoading: dashboardLoading, isError: dashboardError, refetch: refetchDashboard } = useDashboardQuery()
  const { save: saveWeeklyGoal } = useUpdateWeeklyGoal()
  const isInitialLoading = booksLoading || dashboardLoading
  const isError = booksError || dashboardError

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [goalError, setGoalError] = useState<string | null>(null)

  const stats = dashboard?.stats ?? null
  const activity = dashboard?.activity ?? null
  const user = dashboard?.user ?? null

  const weeklyGoal = dashboard?.weekly_goal ?? 7

  const { totalRead } = useMemo(() => calculateOverallProgress(books), [books])
  const booksComplete = useMemo(() => books.filter(b => b.chapters_read >= b.num_chapters).length, [books])
  const hasAnyProgress = !isInitialLoading && totalRead > 0

  const startEditingGoal = () => { setGoalInput(String(weeklyGoal)); setGoalError(null); setEditingGoal(true) }
  const cancelEditingGoal = () => { setGoalError(null); setEditingGoal(false) }
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
    return { cat, read: catRead, total, pct: total > 0 ? catRead / total : 0 }
  }), [books])

  const weekChapters = stats?.chapters_this_week ?? 0
  const atGoal = weekChapters >= weeklyGoal

  const firstName = user?.name?.split(' ')[0] ?? 'friend'

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: 'var(--color-shelf)' }}>
      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      {isError ? (
        <div className="max-w-3xl mx-auto w-full px-4 py-8 md:py-14">
          <section aria-label="Dashboard unavailable" style={LEAF_STYLE}>
            <p className="text-sm text-center" style={{ color: dimText }}>
              Could not load your dashboard.
            </p>
            <div className="flex justify-center mt-4">
              <button
                onClick={() => { refetchBooks(); refetchDashboard() }}
                className="text-xs font-semibold uppercase px-4 py-2 rounded-lg transition-colors"
                style={{ letterSpacing: '0.08em', color: 'var(--color-gilt)', border: '1px solid rgba(210,166,63,0.4)' }}
              >
                Try again
              </button>
            </div>
          </section>
        </div>
      ) : (
      <div className="max-w-3xl mx-auto w-full px-4 py-8 md:py-14">
        <section aria-label="Today's record" style={LEAF_STYLE}>

          {/* Head */}
          <div id="tour-dash-header" style={{ textAlign: 'center', marginBottom: 8 }}>
            <p className="vol-num" style={{ margin: 0, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: dimText, ...fadeUp(0) }}>
              {formatDate()}
            </p>
            <h1 className="slab" style={{ margin: '10px 0 0', fontSize: 'clamp(24px, 4vw, 38px)', color: primaryText, ...fadeUp(40) }}>
              {getGreeting()}, {firstName}.
            </h1>
            <div aria-hidden style={{ margin: '16px auto 0', width: 'min(320px, 55%)', ...fadeUp(70) }}>
              <div style={{ height: 2, background: 'var(--color-leaf-red)' }} />
              <div style={{ height: 1, marginTop: 3, background: 'var(--color-leaf-red)' }} />
            </div>
            {isInitialLoading ? (
              <div className="flex justify-center mt-4"><Skeleton className="h-4 w-72 max-w-full" /></div>
            ) : (
              <p className="vol-num" style={{ margin: '14px 0 0', fontSize: 12, letterSpacing: '0.14em', color: 'rgba(35,31,26,0.72)', ...fadeUp(100) }}>
                {hasAnyProgress
                  ? `${totalRead.toLocaleString()} of ${TOTAL_CHAPTERS.toLocaleString()} chapters · ${booksComplete} of ${TOTAL_BOOKS} books complete`
                  : 'Nothing logged yet — open the Tracker to begin your first volume.'}
              </p>
            )}
          </div>

          <LeafDivider />

          {/* Marginalia: streak, today, weekly goal */}
          <div className="flex flex-col md:flex-row" style={fadeUp(130)}>
            <LeafMarginaliaItem
              first
              icon={<FlameIcon size={15} />}
              label="Streak"
              value={isInitialLoading ? undefined : `${stats?.current_streak ?? 0}d`}
            >
              {isInitialLoading ? <Skeleton className="h-7 w-14 mt-1.5" /> : undefined}
            </LeafMarginaliaItem>
            <LeafMarginaliaItem
              icon={<CalendarIcon size={15} />}
              label="Today"
              value={isInitialLoading ? undefined : `${stats?.chapters_today ?? 0} ch.`}
            >
              {isInitialLoading ? <Skeleton className="h-7 w-14 mt-1.5" /> : undefined}
            </LeafMarginaliaItem>

            <LeafMarginaliaItem
              id="tour-dash-weekly-goal"
              flexGrow={1.4}
              label={
                <span className="flex items-center gap-1.5">
                  Weekly Goal
                  {!editingGoal && !isInitialLoading && (
                    <button
                      onClick={startEditingGoal}
                      className="p-0.5 rounded-md transition-colors"
                      style={{ color: dimText }}
                      title="Edit goal"
                      aria-label="Edit weekly goal"
                    >
                      <PencilIcon size={12} />
                    </button>
                  )}
                </span>
              }
            >
              {isInitialLoading ? (
                <Skeleton className="h-7 w-24 mt-1.5" />
              ) : editingGoal ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="number" min={1} max={200}
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveGoal(goalInput)
                      if (e.key === 'Escape') cancelEditingGoal()
                    }}
                    autoFocus
                    className="w-16 px-2 py-1 rounded-lg outline-none text-sm text-center"
                    style={{
                      background: 'rgba(35,31,26,0.06)',
                      border: goalError ? '1px solid rgba(158,42,34,0.6)' : '1px solid rgba(35,31,26,0.25)',
                      color: primaryText,
                    }}
                  />
                  <button
                    onClick={() => saveGoal(goalInput)}
                    className="text-xs px-2 py-1 rounded-lg font-medium transition-colors"
                    style={{ background: 'rgba(35,31,26,0.1)', color: primaryText }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <span className="slab text-2xl mt-1 tabular-nums" style={{ color: primaryText }}>
                  {weekChapters}<span className="text-sm" style={{ color: dimText }}> / {weeklyGoal}</span>
                </span>
              )}

              {goalError && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-leaf-red)' }} role="alert">{goalError}</p>
              )}
              {!isInitialLoading && !editingGoal && (
                <div className="w-full max-w-[160px] mt-2">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min((weekChapters / weeklyGoal) * 100, 100)}%`,
                        background: atGoal ? 'linear-gradient(90deg, rgba(80,200,140,0.85), rgba(100,225,165,0.9))' : GILT,
                      }}
                    />
                  </div>
                </div>
              )}
            </LeafMarginaliaItem>
          </div>

          <LeafDivider />

          {/* Activity */}
          <div style={fadeUp(160)}>
            <LeafSectionLabel>Reading Activity</LeafSectionLabel>
            <ActivityHeatmap activity={activity ?? []} />
          </div>

          <LeafDivider />

          {/* Continue reading */}
          <div id="tour-dash-continue" style={fadeUp(190)}>
            <LeafSectionLabel>Continue Reading</LeafSectionLabel>
            {continueBooks.length > 0 ? (
              <div>
                {continueBooks.map(book => (
                  <DashboardEntryRow
                    key={book.name}
                    label={book.name}
                    trailing={`${book.chapters_read} / ${book.num_chapters}`}
                    progress={calculateProgress(book) / 100}
                    ruleColor={CLOTH[book.category]}
                    onClick={() => navigate('/tracker', { state: { selectBook: book.name } })}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <span style={{ color: dimText }}><BookOpenIcon size={28} /></span>
                <p className="text-sm text-center" style={{ color: dimText }}>Start reading to see books here</p>
                <button
                  onClick={() => navigate('/tracker')}
                  className="text-xs font-medium hover:underline mt-1"
                  style={{ color: dimText }}
                >
                  Open Tracker →
                </button>
              </div>
            )}
          </div>

          <LeafDivider />

          {/* Testament breakdown */}
          <div style={fadeUp(220)}>
            <LeafSectionLabel>Testament Progress</LeafSectionLabel>
            {[
              { label: 'Old Testament', read: otRead, total: otTotal },
              { label: 'New Testament', read: ntRead, total: ntTotal },
            ].map(({ label, read, total }) => (
              <DashboardEntryRow
                key={label}
                label={label}
                trailing={`${read.toLocaleString()} / ${total.toLocaleString()} · ${total > 0 ? Math.round((read / total) * 100) : 0}%`}
                progress={total > 0 ? read / total : 0}
                ruleColor={TESTAMENT_RULE[label]}
                onClick={() => navigate('/tracker', { state: { filterTestament: label } })}
              />
            ))}
          </div>

          <LeafDivider />

          {/* Category breakdown */}
          <div style={fadeUp(250)}>
            <LeafSectionLabel>Category Progress</LeafSectionLabel>
            {categoryProgress.map(({ cat, read, total, pct }) => (
              <DashboardEntryRow
                key={cat}
                icon={<CategoryIcon category={cat} size={13} />}
                label={cat}
                trailing={`${read} / ${total}`}
                progress={pct}
                ruleColor={CLOTH[cat]}
                onClick={() => navigate('/tracker', { state: { filterCategory: cat } })}
              />
            ))}
          </div>

          <LeafDivider />

          {/* Reading Rhythm */}
          <div style={fadeUp(280)}>
            <ReadingRhythm />
          </div>
        </section>

        <footer className="text-center text-sm py-4" style={{ color: 'rgba(242,236,221,0.55)', ...fadeUp(310) }}>
          Made by Terrance Huang
        </footer>
      </div>
      )}
    </div>
  )
}
