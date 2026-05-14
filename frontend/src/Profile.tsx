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

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('app_jwt')
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

const TOTAL_BOOKS = 66

export default function Profile({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const headers = authHeaders()
    Promise.all([
      fetch('/auth/me', { headers }).then(r => {
        if (r.status === 401) { onLogout(); return null }
        return r.json()
      }),
      fetch('/api/cycles', { headers }).then(r => {
        if (r.status === 401) { onLogout(); return null }
        return r.json()
      }),
    ]).then(([userData, cyclesData]) => {
      if (userData) setUser(userData)
      if (cyclesData) setCycles(cyclesData)
    })
  }, [])

  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null

  const handleNewCycle = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: authHeaders(),
      })
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
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
        <h1 className="text-3xl font-bold text-center flex-1">Profile</h1>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>Sign out</button>
      </div>

      <div className="flex flex-col gap-6 px-8 py-4 max-w-xl mx-auto w-full">
        {/* User info */}
        <div className="flex items-center gap-4">
          {user?.picture_url ? (
            <img src={user.picture_url} alt="avatar" className="w-16 h-16 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center text-2xl">
              {user?.name?.[0] ?? '?'}
            </div>
          )}
          <div>
            <p className="text-xl font-semibold">{user?.name ?? '—'}</p>
            <p className="text-base-content/60">{user?.email ?? '—'}</p>
          </div>
        </div>

        {/* Current cycle stats */}
        {currentCycle && (
          <div className="card border-2 p-4 gap-2">
            <h2 className="text-lg font-bold">Current Cycle (Cycle {currentCycle.cycle_number})</h2>
            <p>Books complete: {currentCycle.books_complete} / {TOTAL_BOOKS}</p>
            <p>Chapters read: {currentCycle.chapters_read} / 1189</p>
            <p>Progress: {currentCycle.total_chapters > 0
              ? Math.round((currentCycle.chapters_read / 1189) * 100)
              : 0}%</p>
          </div>
        )}

        <button
          className="btn btn-primary w-fit"
          onClick={() => dialogRef.current?.showModal()}
        >
          Start New Cycle
        </button>

        {/* Cycle history */}
        {cycles.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-2">Cycle History</h2>
            <div className="flex flex-col gap-2">
              {cycles.map((cycle, i) => {
                const isCurrent = i === cycles.length - 1
                const pct = Math.round((cycle.chapters_read / 1189) * 100)
                return (
                  <div key={cycle.cycle_id} className="flex items-center justify-between border rounded px-4 py-2">
                    <span className="font-medium">Cycle {cycle.cycle_number}</span>
                    {isCurrent ? (
                      <span className="badge badge-primary">current</span>
                    ) : (
                      <span className="text-base-content/60">{pct}% · {cycle.chapters_read} chapters · {cycle.books_complete} books complete</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Start a new cycle?</h3>
          <p className="py-4">
            Starting a new cycle resets your reading progress. Your current cycle's progress is saved in your history.
          </p>
          <div className="modal-action">
            <button className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button className="btn btn-primary" onClick={handleNewCycle} disabled={creating}>
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
