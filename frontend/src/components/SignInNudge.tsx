import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useBooksQuery } from '../lib/queries'

const DISMISSED_KEY = 'signin_nudge_dismissed_at'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
const MIN_CHAPTERS = 3

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < SNOOZE_MS
  } catch {
    return false
  }
}

/** Reminds a guest with a few chapters logged that their progress lives in this browser only. */
export default function SignInNudge() {
  const { jwt, isGuest, openSignIn } = useAuth()
  const { data: books = [] } = useBooksQuery()
  const [hidden, setHidden] = useState(snoozed)

  // Counted from the books query so the Tracker's optimistic update brings it up on the 3rd chapter.
  const chapters = books.reduce((s, b) => s + b.chapters_read, 0)
  // A visitor has no token and nothing to lose yet; a signed-in user has nothing to nudge toward.
  if (!jwt || !isGuest || hidden || chapters < MIN_CHAPTERS) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* hides for this visit only */ }
    setHidden(true)
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 flex-wrap text-xs py-2 px-4"
      style={{ background: 'var(--color-shelf-lit)', color: 'var(--color-leaf)', borderBottom: '1px solid rgba(210,166,63,0.35)' }}
    >
      <span>Your progress lives only in this browser. Sign in to keep it safe and use it on other devices.</span>
      <span className="flex items-center gap-2">
        <button
          onClick={() => openSignIn('save')}
          className="px-3 py-1 rounded font-semibold"
          style={{ background: 'var(--color-gilt)', color: 'var(--color-shelf)' }}
        >
          Sign in with Google
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="px-1.5 py-1"
          style={{ color: 'rgba(242,236,221,0.6)' }}
        >
          ✕
        </button>
      </span>
    </div>
  )
}
