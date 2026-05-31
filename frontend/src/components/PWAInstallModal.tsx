import { useEffect, useRef } from 'react'

interface PWAInstallModalProps {
  onDismiss: () => void
}

type Platform = 'ios' | 'android'

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function shouldShowPWAPrompt(): boolean {
  if (isStandalone()) return false
  if (detectPlatform() === null) return false
  return localStorage.getItem('pwa_install_seen') !== 'true'
}

export default function PWAInstallModal({ onDismiss }: PWAInstallModalProps) {
  const platform = detectPlatform()
  const deferredPromptRef = useRef<Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt()
      const { outcome } = await deferredPromptRef.current.userChoice
      if (outcome === 'accepted') {
        dismiss()
        return
      }
    }
    dismiss()
  }

  const dismiss = () => {
    localStorage.setItem('pwa_install_seen', 'true')
    onDismiss()
  }

  if (!platform) return null

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'pwaFadeIn 0.2s ease forwards',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install app"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
          background: 'linear-gradient(160deg, #0d1533 0%, #060c1e 100%)',
          border: '1px solid rgba(150,175,255,0.12)',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          padding: '1.5rem 1.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'pwaSlideUp 0.3s cubic-bezier(0.32,0.72,0,1) forwards',
          maxWidth: 520,
          margin: '0 auto',
        }}
      >
        {/* drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(150,175,255,0.2)',
          alignSelf: 'center', marginBottom: '0.25rem',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(150,175,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
          }}>
            ✦
          </div>
          <div>
            <p style={{
              margin: 0,
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: '1rem',
              color: '#dde6ff',
              letterSpacing: '0.02em',
            }}>
              Add to Home Screen
            </p>
            <p style={{
              margin: '0.25rem 0 0',
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 300,
              fontSize: '0.8rem',
              color: 'rgba(150,175,255,0.55)',
              lineHeight: 1.5,
            }}>
              Install Bible Books Tracker for quick access and a better experience.
            </p>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(150,175,255,0.09)',
          borderRadius: 12,
          padding: '0.9rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}>
          {platform === 'ios' ? (
            <>
              <Step n={1} text={<>Tap the <ShareIcon /> <strong style={{ color: '#dde6ff' }}>Share</strong> button in Safari's toolbar</>} />
              <Step n={2} text={<>Scroll down and tap <strong style={{ color: '#dde6ff' }}>"Add to Home Screen"</strong></>} />
              <Step n={3} text={<>Tap <strong style={{ color: '#dde6ff' }}>"Add"</strong> in the top-right corner</>} />
            </>
          ) : (
            <>
              <p style={{
                margin: '0 0 0.1rem',
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 400,
                fontSize: '0.75rem',
                color: 'rgba(150,175,255,0.5)',
                lineHeight: 1.5,
              }}>Works best in <strong style={{ color: 'rgba(150,175,255,0.75)' }}>Google Chrome</strong></p>
              <Step n={1} text={<>Tap the <MenuIcon /> <strong style={{ color: '#dde6ff' }}>menu</strong> in your browser</>} />
              <Step n={2} text={<>Tap <strong style={{ color: '#dde6ff' }}>"Add to Home Screen"</strong> or <strong style={{ color: '#dde6ff' }}>"Install App"</strong></>} />
              <Step n={3} text={<>Tap <strong style={{ color: '#dde6ff' }}>"Install"</strong> to confirm</>} />
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
          {platform === 'android' && deferredPromptRef.current && (
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                padding: '0.7rem',
                borderRadius: 10,
                border: '1px solid rgba(150,175,255,0.25)',
                background: 'rgba(70,100,255,0.18)',
                color: '#c8d8ff',
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 600,
                fontSize: '0.85rem',
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              Install Now
            </button>
          )}
          <button
            onClick={dismiss}
            style={{
              flex: platform === 'android' && deferredPromptRef.current ? '0 0 auto' : 1,
              padding: '0.7rem 1.2rem',
              borderRadius: 10,
              border: '1px solid rgba(150,175,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(150,175,255,0.5)',
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pwaFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pwaSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  )
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(100,130,255,0.15)',
        border: '1px solid rgba(150,175,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Raleway', sans-serif",
        fontSize: '0.65rem',
        fontWeight: 700,
        color: 'rgba(150,175,255,0.7)',
        marginTop: 1,
      }}>
        {n}
      </div>
      <span style={{
        fontFamily: "'Raleway', sans-serif",
        fontSize: '0.82rem',
        color: 'rgba(160,185,255,0.65)',
        lineHeight: 1.5,
      }}>
        {text}
      </span>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline', width: '0.9em', height: '0.9em', verticalAlign: 'text-bottom', color: '#7ab8ff', margin: '0 1px' }}
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ display: 'inline', width: '0.9em', height: '0.9em', verticalAlign: 'text-bottom', color: '#7ab8ff', margin: '0 1px' }}
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}
