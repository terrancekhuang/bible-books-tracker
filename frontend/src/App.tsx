import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useAuth } from './lib/AuthContext'
import { useKeyChord } from './lib/useKeyChord'
import Login from './Login'
import Profile from './Profile'
import Tracker from './components/Tracker'
import Dashboard from './Dashboard'
import PWAInstallModal from './components/PWAInstallModal'
import { shouldShowPWAPrompt } from './lib/pwa'
import CelestialBackground from './components/CelestialBackground'

export default function App() {
  const { jwt } = useAuth()
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const navigate = useNavigate()

  const [showHelp, setShowHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const { arm: armGChord, consume: consumeGChord } = useKeyChord();

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        updateSwRef.current = updateSW;
        setShowUpdateBanner(true);
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
    });
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Show PWA prompt on first login (not on page refresh)
  const prevJwtRef = useRef<string | null>(jwt)
  useEffect(() => {
    const prev = prevJwtRef.current
    prevJwtRef.current = jwt
    if (!jwt || prev || !shouldShowPWAPrompt()) return
    const t = setTimeout(() => setShowPwaPrompt(true), 0)
    return () => clearTimeout(t)
  }, [jwt])

  useEffect(() => {
    if (!jwt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowHelp(v => !v);
        return;
      }
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }
      if (e.key === 'g' && !isInput) {
        e.preventDefault();
        armGChord();
        return;
      }
      if (!isInput && (e.key === 'd' || e.key === 't' || e.key === 'p') && consumeGChord()) {
        e.preventDefault();
        if (e.key === 'd') navigate('/');
        else if (e.key === 't') navigate('/tracker');
        else navigate('/profile');
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [jwt, showHelp, navigate, armGChord, consumeGChord]);

  return (
    <>
      {jwt && <CelestialBackground />}
      <Routes>
        <Route
          path="/login"
          element={jwt ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={jwt ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tracker"
          element={jwt ? <Tracker /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/profile"
          element={jwt ? <Profile /> : <Navigate to="/login" replace />}
        />
      </Routes>
      {showPwaPrompt && <PWAInstallModal onDismiss={() => setShowPwaPrompt(false)} />}

      {showUpdateBanner && (
        <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-4 py-3 text-sm"
          style={{ background: 'rgba(10,18,50,0.97)', borderTop: '1px solid rgba(150,175,255,0.2)', color: 'rgba(195,210,255,0.9)' }}
        >
          <span>A new version is available.</span>
          <div className="flex gap-2">
            <button
              onClick={() => { updateSwRef.current?.(true); }}
              className="px-3 py-1 rounded font-medium text-xs"
              style={{ background: 'rgba(99,102,241,0.8)', color: '#fff' }}
            >
              Reload
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="px-3 py-1 rounded text-xs"
              style={{ background: 'rgba(150,175,255,0.1)', color: 'rgba(195,210,255,0.7)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {jwt && !isMobile && (
        <button
          onClick={() => setShowHelp(v => !v)}
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
          className="fixed bottom-20 md:bottom-5 right-5 z-40 flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-all select-none font-bold text-sm"
          style={{
            background: 'rgba(13,21,51,0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(150,175,255,0.18)',
            color: 'rgba(195,210,255,0.7)',
          }}
        >
          ?
        </button>
      )}

      {jwt && showHelp && !isMobile && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(3,8,16,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowHelp(false)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            style={{
              background: 'rgba(10,18,50,0.96)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(150,175,255,0.22)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-base font-semibold text-[#dde6ff]"
                style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}
              >
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-[rgba(150,175,255,0.5)] hover:text-[rgba(195,210,255,0.9)] text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2.5" style={{ fontFamily: "'Raleway', sans-serif" }}>
              {([
                { keys: ['g', 'd'], description: 'Go to Dashboard' },
                { keys: ['g', 't'], description: 'Go to Tracker' },
                { keys: ['g', 'p'], description: 'Go to Profile' },
                { keys: null, description: '' },
                { keys: ['/'], description: 'Focus search' },
                { keys: ['←', '→', '↑', '↓'], altKeys: ['h', 'l', 'k', 'j'], description: 'Navigate books' },
                { keys: ['g', 'g'], description: 'Go to first book' },
                { keys: ['G'], description: 'Go to last book' },
                { keys: ['Tab'], altKeys: ['i'], description: 'Focus chapter input' },
                { keys: ['Enter'], description: 'Submit progress' },
                { keys: ['u'], description: 'Undo last entry' },
                { keys: ['R'], description: 'Reset all progress (two-step)' },
                { keys: ['A'], description: 'Mark all chapters as read (two-step)' },
                { keys: ['Esc'], description: 'Deselect / clear search' },
                { keys: ['?'], description: 'Show / hide this help' },
              ] as { keys: string[] | null; altKeys?: string[]; description: string }[]).map(({ keys, altKeys, description }, i) => (
                keys === null
                  ? <div key={i} className="border-t my-1" style={{ borderColor: 'rgba(150,175,255,0.1)' }} />
                  : (
                    <div key={description} className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {keys.map(k => (
                          <kbd
                            key={k}
                            className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-mono min-w-[1.5rem]"
                            style={{ background: 'rgba(150,175,255,0.1)', border: '1px solid rgba(150,175,255,0.2)', color: 'rgba(195,210,255,0.85)' }}
                          >
                            {k}
                          </kbd>
                        ))}
                        {altKeys && (
                          <>
                            <span className="text-xs px-0.5" style={{ color: 'rgba(150,175,255,0.35)' }}>/</span>
                            {altKeys.map(k => (
                              <kbd
                                key={k}
                                className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-mono min-w-[1.5rem]"
                                style={{ background: 'rgba(150,175,255,0.1)', border: '1px solid rgba(150,175,255,0.2)', color: 'rgba(195,210,255,0.85)' }}
                              >
                                {k}
                              </kbd>
                            ))}
                          </>
                        )}
                      </div>
                      <span className="text-sm" style={{ color: 'rgba(195,210,255,0.6)' }}>{description}</span>
                    </div>
                  )
              ))}
              <p className="text-xs pt-1" style={{ color: 'rgba(150,175,255,0.35)' }}>Book navigation shortcuts work on the Tracker page.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
