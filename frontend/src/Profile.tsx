import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUserQuery, useCyclesQuery, useStatsQuery, useSettingsQuery } from './lib/queries'
import { useCreateCycle } from './lib/useCycleMutations'
import { useUpdateWeeklyGoal } from './lib/useDashboardMutations'
import { TOTAL_BOOKS, TOTAL_CHAPTERS } from './lib/trackerLogic'
import { getAchievements } from './lib/achievements'
import { BookOpenIcon, TrophyIcon, StarIcon, TargetIcon, PencilIcon } from './components/Icons'
import AchievementMedallion from './components/AchievementMedallion'
import DashboardEntryRow from './components/DashboardEntryRow'
import LeafDivider from './components/LeafDivider'
import LeafSectionLabel from './components/LeafSectionLabel'
import LeafMarginaliaItem from './components/LeafMarginaliaItem'
import NavBar from './components/NavBar'
import Skeleton from './components/Skeleton'
import { leafSurfaceStyle } from './lib/leafSurface'
import { GILT } from './lib/volumesTokens'

const primaryText = 'var(--color-ink)'
const dimText = 'rgba(35,31,26,0.55)'
const bodyText = 'rgba(35,31,26,0.78)'
const trackBg = 'rgba(35,31,26,0.1)'

const LEAF_STYLE: CSSProperties = {
  padding: 'clamp(24px, 4vw, 52px)',
  ...leafSurfaceStyle(GILT),
}

const fadeUp = (delay: number): CSSProperties => ({
  animation: 'fade-slide-up 0.5s ease-out both',
  animationDelay: `${delay}ms`,
})

export default function Profile() {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { create: createCycle, isCreating } = useCreateCycle()

  const { data: user } = useCurrentUserQuery()
  const { data: rawCycles } = useCyclesQuery()
  const { data: stats } = useStatsQuery()
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery()
  const { save: saveWeeklyGoal } = useUpdateWeeklyGoal()

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [goalError, setGoalError] = useState<string | null>(null)

  const cycles = rawCycles ?? []
  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null
  const pastCycles = cycles.slice(0, -1)

  const weeklyGoal = settings?.weekly_goal ?? 7
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
    const saved = await saveWeeklyGoal(n)
    if (!saved) setGoalError("Couldn't save your goal — please try again.")
  }

  const avgPerDay = stats ? +(stats.chapters_last_7_days / 7).toFixed(1) : 0
  const paceCardValue = avgPerDay > 0 ? `${avgPerDay} ch/day` : 'No recent activity'
  const chaptersRemaining = currentCycle ? TOTAL_CHAPTERS - currentCycle.chapters_read : 0
  const projectedDays = avgPerDay > 0 ? Math.round(chaptersRemaining / avgPerDay) : null
  const projectionNote = projectedDays !== null
    ? projectedDays < 14 ? `~${projectedDays} days to finish` : `~${Math.round(projectedDays / 7)} weeks to finish`
    : null

  const achievements = getAchievements(stats ?? null, cycles)

  // createCycle only resolves once the book grid has been refetched, so Tracker paints
  // the new empty cycle rather than the one that was just finished.
  const handleNewCycle = async () => {
    if (!await createCycle()) return
    dialogRef.current?.close()
    navigate('/tracker')
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: 'var(--color-shelf)' }}>
      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      <div className="max-w-3xl mx-auto w-full px-4 py-8 md:py-14">
        <section aria-label="Profile" style={LEAF_STYLE}>

          {/* Bookplate */}
          <div style={{ textAlign: 'center', ...fadeUp(0) }}>
            <p className="vol-num" style={{ margin: 0, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: dimText }}>
              This Volume Belongs To
            </p>
            <div style={{ position: 'relative', margin: '14px auto 0', maxWidth: 360, padding: '26px 24px 22px', border: '1px solid rgba(35,31,26,0.28)', borderRadius: 4 }}>
              <div aria-hidden style={{ position: 'absolute', inset: 6, border: '1px solid rgba(35,31,26,0.14)', borderRadius: 2, pointerEvents: 'none' }} />
              {user?.picture_url ? (
                <img
                  src={user.picture_url} alt="" referrerPolicy="no-referrer"
                  style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto', display: 'block', boxShadow: '0 0 0 2px rgba(35,31,26,0.15)' }}
                />
              ) : (
                <div
                  style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(35,31,26,0.08)', fontSize: 22, fontWeight: 700, color: primaryText }}
                >
                  {user?.name?.[0] ?? '?'}
                </div>
              )}
              <h1 className="slab" style={{ margin: '14px 0 0', fontSize: 'clamp(20px, 3vw, 28px)', color: primaryText }}>
                {user?.name ?? '—'}
              </h1>
              <p className="vol-num" style={{ margin: '6px 0 0', fontSize: 12, letterSpacing: '0.08em', color: dimText }}>
                {user?.email ?? '—'}
              </p>
            </div>
          </div>

          <LeafDivider />

          {/* Lifetime figures */}
          <div className="flex flex-col md:flex-row" style={fadeUp(80)}>
            <LeafMarginaliaItem first icon={<TrophyIcon size={15} />} label="Best Streak" value={`${stats?.best_streak ?? 0}d`} />
            <LeafMarginaliaItem icon={<BookOpenIcon size={15} />} label="Total Chapters" value={stats?.total_chapters ?? 0} />
            <LeafMarginaliaItem icon={<StarIcon size={15} />} label="Reading Days" value={stats?.total_days ?? 0} />
            <LeafMarginaliaItem icon={<TargetIcon size={15} />} label="Avg Pace" value={paceCardValue} />
          </div>
          {projectionNote && (
            <p className="italic text-center mt-3" style={{ color: dimText, fontSize: 14 }}>
              {projectionNote}
            </p>
          )}

          <LeafDivider />

          {/* Weekly goal */}
          <div style={{ textAlign: 'center', ...fadeUp(110) }}>
            <LeafSectionLabel>Weekly Goal</LeafSectionLabel>
            <div className="inline-flex flex-col items-center">
              {settingsLoading ? (
                <Skeleton className="h-9 w-40" />
              ) : editingGoal ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={200}
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveGoal(goalInput)
                      if (e.key === 'Escape') cancelEditingGoal()
                    }}
                    autoFocus
                    className="w-20 px-2 py-1 rounded-lg outline-none text-sm text-center"
                    style={{
                      background: 'rgba(35,31,26,0.06)',
                      border: goalError ? '1px solid rgba(158,42,34,0.6)' : '1px solid rgba(35,31,26,0.25)',
                      color: primaryText,
                    }}
                  />
                  <span className="text-sm" style={{ color: dimText }}>chapters / week</span>
                  <button
                    onClick={() => saveGoal(goalInput)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                    style={{ background: 'rgba(35,31,26,0.1)', color: primaryText }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="slab text-3xl font-bold tabular-nums" style={{ color: primaryText }}>{weeklyGoal}</span>
                  <span className="text-sm" style={{ color: dimText }}>chapters / week</span>
                  <button
                    onClick={startEditingGoal}
                    className="p-1 rounded-md transition-colors"
                    style={{ color: dimText }}
                    title="Edit goal"
                    aria-label="Edit weekly goal"
                  >
                    <PencilIcon size={14} />
                  </button>
                </div>
              )}
              {goalError && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--color-leaf-red)' }} role="alert">{goalError}</p>
              )}
            </div>
          </div>

          <LeafDivider />

          {/* Achievements */}
          <div style={fadeUp(140)}>
            <LeafSectionLabel>Achievements</LeafSectionLabel>
            <div className="flex flex-wrap gap-5 justify-center md:justify-start">
              {achievements.map((a, i) => (
                <AchievementMedallion
                  key={a.id}
                  label={a.label}
                  criteria={a.criteria}
                  tier={a.tier}
                  icon={a.icon}
                  earned={a.earned}
                  animDelay={i * 40}
                />
              ))}
            </div>
          </div>

          <LeafDivider />

          {/* Current cycle */}
          {currentCycle && (() => {
            const cyclePct = Math.round((currentCycle.chapters_read / TOTAL_CHAPTERS) * 100)
            return (
              <div style={fadeUp(170)}>
                <LeafSectionLabel>
                  Current Cycle — <span style={{ color: 'var(--color-gilt)' }}>#{currentCycle.cycle_number}</span>
                </LeafSectionLabel>
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: dimText }}>Chapters</span>
                  <span className="font-medium" style={{ color: primaryText }}>
                    {currentCycle.chapters_read} / {TOTAL_CHAPTERS}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: trackBg }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${cyclePct}%`, background: GILT }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  <span style={{ color: dimText }}>{cyclePct}% complete</span>
                  <span style={{ color: dimText }}>{currentCycle.books_complete} / {TOTAL_BOOKS} books</span>
                </div>
              </div>
            )
          })()}

          <LeafDivider />

          {/* Start New Cycle */}
          <div style={{ textAlign: 'center', ...fadeUp(200) }}>
            <button
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'rgba(210,166,63,0.14)',
                border: '1px solid rgba(210,166,63,0.4)',
                color: primaryText,
                letterSpacing: '0.06em',
              }}
              onClick={() => dialogRef.current?.showModal()}
            >
              Start New Cycle
            </button>
          </div>

          <LeafDivider />

          {/* Cycle history */}
          <div style={fadeUp(230)}>
            <LeafSectionLabel>Cycle History</LeafSectionLabel>
            {pastCycles.length > 0 ? (
              <div>
                {pastCycles.map(cycle => {
                  const pct = Math.round((cycle.chapters_read / TOTAL_CHAPTERS) * 100)
                  return (
                    <DashboardEntryRow
                      key={cycle.cycle_id}
                      label={`Cycle ${cycle.cycle_number}`}
                      trailing={`${pct}% · ${cycle.chapters_read} ch · ${cycle.books_complete} bks`}
                      progress={pct / 100}
                      ruleColor={GILT}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-center py-4" style={{ color: dimText }}>
                No earlier cycles yet — complete this one to start your history.
              </p>
            )}
          </div>
        </section>

        <footer className="text-center text-sm py-4" style={{ color: 'rgba(242,236,221,0.55)', ...fadeUp(260) }}>
          Made by Terrance Huang
        </footer>
      </div>

      {/* Confirmation dialog */}
      <dialog
        ref={dialogRef}
        className="cycle-dialog"
        onClick={e => { if (e.target === dialogRef.current) dialogRef.current?.close() }}
      >
        <div style={{ ...leafSurfaceStyle(GILT), padding: '28px 28px 24px', maxWidth: 420, width: '100%', margin: '0 16px' }}>
          <h3 className="slab" style={{ fontSize: 20, color: primaryText, letterSpacing: '0.03em' }}>
            Start a new cycle?
          </h3>
          <p className="py-4 text-sm" style={{ color: bodyText }}>
            Starting a new cycle resets your reading progress. Your current cycle's progress is saved in history.
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ border: '1px solid rgba(35,31,26,0.18)', color: dimText }}
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{
                background: 'rgba(210,166,63,0.18)',
                border: '1px solid rgba(210,166,63,0.5)',
                color: primaryText,
                letterSpacing: '0.05em',
              }}
              onClick={handleNewCycle}
              disabled={isCreating}
            >
              {isCreating ? 'Creating…' : 'Start New Cycle'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
