import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from './lib/AuthContext'
import { GILT } from './lib/volumesTokens'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [signInError, setSignInError] = useState<string | null>(null)

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
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-shelf)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '44px 24px' }}>
        <div style={{ position: 'relative', width: 'min(430px, 100%)', aspectRatio: '3 / 4', display: 'flex' }}>
          {/* The spine edge, seen at a slight angle. */}
          <span
            aria-hidden
            style={{
              flex: '0 0 26px',
              position: 'relative',
              background: 'linear-gradient(90deg, #04140C, #0B2F1E 40%, #14432E 80%)',
              boxShadow: 'inset -8px 0 14px -8px rgba(0,0,0,0.9)',
            }}
          >
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

          {/* The front board. */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              background: 'linear-gradient(128deg, #1B5539 0%, #14432E 46%, #0D3122 100%)',
              boxShadow: '0 30px 60px -26px rgba(0,0,0,0.95), inset 0 0 90px -30px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '38px 30px',
            }}
          >
            {/* Blind-stamped panel, then a gilt fillet inside it. */}
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

            <h1
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
            </h1>
            <div aria-hidden style={{ height: 1, width: 96, margin: '26px 0 30px', background: GILT, opacity: 0.75 }} />

            {/* The way in, printed on a slip laid against the board. */}
            <div
              style={{
                padding: '18px 22px',
                textAlign: 'center',
                backgroundColor: 'var(--color-leaf)',
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px)',
                boxShadow: 'inset 0 0 0 1px rgba(35,31,26,0.18), 0 14px 26px -14px rgba(0,0,0,0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
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
                  style={{ color: 'var(--color-leaf-red)', margin: 0 }}
                  role="alert"
                >
                  {signInError}
                </p>
              )}
            </div>
          </div>
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
