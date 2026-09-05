import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from './lib/AuthContext'
import { GILT } from './lib/volumesTokens'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [signInError, setSignInError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const titlePageRef = useRef<HTMLDivElement>(null)
  const promptButtonRef = useRef<HTMLButtonElement>(null)

  const openBook = useCallback(() => setOpen(true), [])
  const closeBook = useCallback(() => setOpen(false), [])

  /* Opening moves the only thing worth reaching into the book, so focus follows it in;
     closing hands focus back to the prompt that opened it. Both targets only become
     reachable on the render that follows the state change — the title page is `inert`
     until then, and the prompt button isn't mounted — so this waits for that render
     rather than firing inside the handlers. */
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (open) titlePageRef.current?.focus()
    else promptButtonRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBook()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeBook])

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    const googleToken = credentialResponse.credential
    if (!googleToken) return
    setSignInError(null)
    try {
      const res = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: googleToken }),
      })
      if (!res.ok) {
        console.error('Auth failed:', await res.text())
        setSignInError("Couldn't sign in — please try again.")
        return
      }
      const data = await res.json()
      login(data.access_token)
      navigate('/')
    } catch (err) {
      console.error('Auth failed:', err)
      setSignInError("Couldn't reach the server — check your connection and try again.")
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--color-shelf)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 30,
          padding: '32px 20px',
        }}
      >
        <div className="login-scene">
          <div className="login-spread" data-open={open}>
            {/* The room the board swings into — nothing is drawn there until it arrives. */}
            <div className="login-verso-space" aria-hidden />

            {/* Recto — the title page, and the board that lies over it. */}
            <div className="login-leaf">
              <div
                ref={titlePageRef}
                tabIndex={-1}
                inert={!open}
                className="login-recto-content"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'clamp(20px, 4.5%, 40px)',
                  outline: 'none',
                }}
              >
                <h1
                  className="slab"
                  style={{
                    margin: 0,
                    textAlign: 'center',
                    fontSize: 'clamp(20px, 5.6vw, 30px)',
                    lineHeight: 1.16,
                    color: 'var(--color-ink)',
                  }}
                >
                  Bible<br />Books<br />Tracker
                </h1>

                <div aria-hidden style={{ margin: '18px auto 0', width: 'min(220px, 60%)' }}>
                  <div style={{ height: 2, background: 'var(--color-leaf-red)' }} />
                  <div style={{ height: 1, marginTop: 3, background: 'var(--color-leaf-red)' }} />
                </div>

                <p
                  className="vol-num"
                  style={{
                    margin: '20px 0 22px',
                    textAlign: 'center',
                    fontSize: 12,
                    letterSpacing: '0.14em',
                    color: 'rgba(35,31,26,0.72)',
                  }}
                >
                  Sign in to open your record
                </p>

                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={() => {
                    console.error('Google login failed')
                    setSignInError("Couldn't sign in — please try again.")
                  }}
                  theme="outline"
                  shape="pill"
                  size="large"
                />

                {signInError && (
                  <p
                    className="text-sm text-center"
                    style={{ color: 'var(--color-leaf-red)', margin: '14px 0 0', maxWidth: '30ch' }}
                    role="alert"
                  >
                    {signInError}
                  </p>
                )}
              </div>

              <div className="login-cover">
                {/* Front board — cloth, a blind-stamped panel and a gilt fillet inside it. */}
                <div
                  className="login-face login-face--front"
                  style={{
                    background: 'linear-gradient(128deg, #1B5539 0%, #14432E 46%, #0D3122 100%)',
                    boxShadow: '0 30px 60px -26px rgba(0,0,0,0.95), inset 0 0 90px -30px rgba(0,0,0,0.7)',
                    padding: '38px 30px',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 16,
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.10)',
                    }}
                  />
                  <span
                    aria-hidden
                    style={{ position: 'absolute', inset: 26, boxShadow: `inset 0 0 0 1px ${GILT}88` }}
                  />
                  <h2
                    className="slab"
                    style={{
                      margin: 0,
                      textAlign: 'center',
                      color: GILT,
                      lineHeight: 1.14,
                      fontSize: 'clamp(22px, 5.4vw, 34px)',
                      textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,236,180,0.25)',
                    }}
                  >
                    Bible<br />Books<br />Tracker
                  </h2>
                  <div
                    aria-hidden
                    style={{ height: 1, width: 96, margin: '26px 0 0', background: GILT, opacity: 0.75 }}
                  />

                  {/* The board itself opens the book — the prompt below is the same action spelled out. */}
                  <button
                    type="button"
                    className="login-cover-hit"
                    onClick={openBook}
                    disabled={open}
                    aria-label="Open the book to sign in"
                    style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none' }}
                  />
                </div>

                {/* Paste-down — what the board shows once it has come to rest on the verso. */}
                <div
                  className="login-face login-face--back"
                  aria-hidden
                  style={{
                    backgroundColor: '#E9E2CE',
                    backgroundImage: [
                      'repeating-linear-gradient(0deg, rgba(35,31,26,0.03) 0 1px, transparent 1px 4px)',
                      'linear-gradient(178deg, #EFE8D6, #E9E2CE 45%, #DED5BE)',
                    ].join(', '),
                    boxShadow: 'inset 0 0 60px -24px rgba(0,0,0,0.5), 0 26px 50px -24px rgba(0,0,0,0.9)',
                    padding: 'clamp(22px, 8%, 52px)',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      inset: 20,
                      boxShadow: `inset 0 0 0 1px ${GILT}77`,
                    }}
                  />
                  <p
                    className="vol-num"
                    style={{
                      margin: 0,
                      fontSize: 10,
                      letterSpacing: '0.42em',
                      textTransform: 'uppercase',
                      color: 'rgba(35,31,26,0.55)',
                    }}
                  >
                    Ex Libris
                  </p>
                  <div style={{ height: 1, width: 64, margin: '16px 0 20px', background: 'rgba(35,31,26,0.35)' }} />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'clamp(12px, 3.2vw, 14px)',
                      lineHeight: 1.7,
                      fontStyle: 'italic',
                      color: 'rgba(35,31,26,0.8)',
                      maxWidth: '26ch',
                    }}
                  >
                    “Thy word is a lamp unto my feet, and a light unto my path.”
                  </p>
                  <p
                    className="vol-num"
                    style={{
                      margin: '14px 0 0',
                      fontSize: 10,
                      letterSpacing: '0.28em',
                      textTransform: 'uppercase',
                      color: 'rgba(35,31,26,0.5)',
                    }}
                  >
                    Psalm 119:105
                  </p>
                </div>
              </div>

              <span aria-hidden className="login-spine">
                {[0.16, 0.4, 0.64, 0.88].map(t => (
                  <span
                    key={t}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${t * 100}%`,
                      height: 11,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(0,0,0,0.6))',
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>

        {/* The invitation, standing off the book on the shelf beside it. */}
        <div
          style={{
            minHeight: 92,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            textAlign: 'center',
          }}
        >
          {open ? (
            <button
              type="button"
              onClick={closeBook}
              className="vol-num"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '10px 4px',
                fontSize: 11,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: 'rgba(242,236,221,0.5)',
              }}
            >
              Close the book
            </button>
          ) : (
            <>
              <p
                className="vol-num"
                style={{
                  margin: 0,
                  fontSize: 'clamp(14px, 3.6vw, 16px)',
                  color: 'rgba(242,236,221,0.92)',
                }}
              >
                Shall we start keeping the record?
              </p>
              <p
                style={{
                  margin: '6px 0 16px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  maxWidth: '46ch',
                  color: 'rgba(242,236,221,0.55)',
                }}
              >
                Log every chapter you read, hold the streak, and keep a steady rhythm in your reading.
              </p>
              <button
                ref={promptButtonRef}
                type="button"
                onClick={openBook}
                className="login-prompt-btn vol-num"
              >
                Let’s begin!
              </button>
            </>
          )}
        </div>
      </div>

      <footer
        style={{
          textAlign: 'center',
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(242,236,221,0.4)',
          paddingBottom: 20,
        }}
      >
        Made by Terrance Huang
      </footer>
    </div>
  )
}
