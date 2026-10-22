import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthContext'
import { useSyncContext } from '../lib/SyncContext'
import { getToken, isGuestToken, setToken } from '../lib/auth'
import { leafSurfaceStyle } from '../lib/leafSurface'
import { GILT } from '../lib/volumesTokens'

const CONTEXT_LINE = {
  save: 'Save your progress and use it on any device.',
  expired: 'Your session expired. Sign in again to keep syncing.',
}

interface GoogleAuthResponse {
  access_token: string
  from_guest: 'upgraded' | 'merged' | null
  chapters_added: number
}

function confirmation({ from_guest, chapters_added: n }: GoogleAuthResponse): string | null {
  if (from_guest === 'upgraded') return 'Signed in — your progress is saved'
  if (from_guest !== 'merged') return null
  if (n === 0) return 'Signed in'
  return `Signed in. ${n} ${n === 1 ? 'chapter' : 'chapters'} from this browser ${n === 1 ? 'was' : 'were'} added to your account.`
}

/**
 * The one way to sign in, over whatever page the user is on. A native modal <dialog> gives
 * the focus trap, Esc, and focus back to the opener on close for free.
 */
export default function SignInDialog() {
  const { signInReason, closeSignIn, login } = useAuth()
  const { syncNow } = useSyncContext()
  const queryClient = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current!
    if (signInReason && !dialog.open) dialog.showModal()
    else if (!signInReason && dialog.open) dialog.close()
  }, [signInReason])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const handleSuccess = async ({ credential }: { credential?: string }) => {
    if (!credential) return
    setError(null)
    // Only a guest's token travels with the credential — it is what carries their progress
    // over. A signed-in token would be expired by now, and the backend would reject it.
    const token = getToken()
    const guestAuth: Record<string, string> = token && isGuestToken(token) ? { Authorization: `Bearer ${token}` } : {}
    try {
      const res = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...guestAuth },
        body: JSON.stringify({ credential }),
      })
      if (!res.ok) {
        console.error('Auth failed:', await res.text())
        setError("Couldn't sign in. Please try again.")
        return
      }
      const data: GoogleAuthResponse = await res.json()
      if (data.from_guest === 'upgraded') {
        // Same account, same progress — keep what's on screen and just refresh it.
        setToken(data.access_token)
        void queryClient.invalidateQueries()
      } else {
        login(data.access_token)
      }
      closeSignIn()
      setToast(confirmation(data))
      // Writes held while a session was expired go out now.
      void syncNow()
    } catch (err) {
      console.error('Auth failed:', err)
      setError("Couldn't reach the server. Check your connection.")
    }
  }

  return (
    <>
      <dialog
        ref={ref}
        className="app-dialog"
        aria-labelledby="sign-in-title"
        onClose={() => { setError(null); closeSignIn() }}
        onClick={e => { if (e.target === ref.current) ref.current.close() }}
        // Page shortcuts (n, Esc to deselect…) listen on document; nothing behind the popup should react.
        onKeyDown={e => e.stopPropagation()}
      >
        <div style={{ ...leafSurfaceStyle(GILT), position: 'relative', padding: '30px 28px 26px', width: 'min(360px, calc(100vw - 32px))', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="absolute top-2 right-3 text-lg leading-none px-2 py-1"
            style={{ color: 'rgba(35,31,26,0.55)' }}
          >
            ✕
          </button>
          <h2 id="sign-in-title" className="slab" style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
            Bible Books Tracker
          </h2>
          <div aria-hidden style={{ margin: '12px auto 0', width: 120 }}>
            <div style={{ height: 2, background: 'var(--color-leaf-red)' }} />
            <div style={{ height: 1, marginTop: 3, background: 'var(--color-leaf-red)' }} />
          </div>
          <p className="text-sm" style={{ margin: '16px 0 20px', color: 'rgba(35,31,26,0.78)', lineHeight: 1.5 }}>
            {signInReason && CONTEXT_LINE[signInReason]}
          </p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Couldn't sign in. Please try again.")}
              theme="outline"
              shape="pill"
              size="large"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm" style={{ color: 'var(--color-leaf-red)', margin: '14px 0 0' }}>
              {error}
            </p>
          )}
        </div>
      </dialog>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm text-center"
          style={{
            width: 'max-content',
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--color-shelf)',
            border: '1px solid rgba(210,166,63,0.5)',
            color: 'var(--color-gilt)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
