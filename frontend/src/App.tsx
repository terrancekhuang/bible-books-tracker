import { useLayoutEffect, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { TOKEN_KEY, getToken } from './lib/auth'
import Login from './Login'
import Profile from './Profile'
import Tracker from './components/Tracker'
import Dashboard from './Dashboard'
import PWAInstallModal, { shouldShowPWAPrompt } from './components/PWAInstallModal'

export default function App() {
  const [jwt, setJwt] = useState<string | null>(getToken)
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  const navigate = useNavigate()

  const [showHelp, setShowHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const gKeyRef = useRef<string | null>(null);
  const gKeyTimeoutRef = useRef<number | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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
        gKeyRef.current = 'g';
        if (gKeyTimeoutRef.current !== null) clearTimeout(gKeyTimeoutRef.current);
        gKeyTimeoutRef.current = window.setTimeout(() => { gKeyRef.current = null; }, 500);
        return;
      }
      if (!isInput && gKeyRef.current === 'g' && (e.key === 'd' || e.key === 't' || e.key === 'p')) {
        e.preventDefault();
        if (gKeyTimeoutRef.current !== null) clearTimeout(gKeyTimeoutRef.current);
        gKeyRef.current = null;
        if (e.key === 'd') navigate('/');
        else if (e.key === 't') navigate('/tracker');
        else navigate('/profile');
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [jwt, showHelp, navigate]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    setJwt(token)
    if (shouldShowPWAPrompt()) setShowPwaPrompt(true)
    navigate('/')
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setJwt(null)
    navigate('/login')
  }

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={jwt ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
        />
        <Route
          path="/"
          element={jwt ? <Dashboard onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tracker"
          element={jwt ? <Tracker onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/profile"
          element={jwt ? <Profile onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} /> : <Navigate to="/login" replace />}
        />
      </Routes>
      {showPwaPrompt && <PWAInstallModal onDismiss={() => setShowPwaPrompt(false)} />}

      {jwt && !isMobile && (
        <button
          onClick={() => setShowHelp(v => !v)}
          title="Keyboard shortcuts (?)"
          className="fixed bottom-20 md:bottom-5 right-5 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors text-sm font-bold select-none"
        >
          ?
        </button>
      )}

      {jwt && showHelp && !isMobile && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">
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
                  ? <div key={i} className="border-t border-slate-200 dark:border-slate-700 my-1" />
                  : (
                    <div key={description} className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {keys.map(k => (
                          <kbd
                            key={k}
                            className="inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 text-xs font-mono shadow-[0_1px_0_#cbd5e1] dark:shadow-[0_1px_0_#475569] text-slate-700 dark:text-slate-300 min-w-[1.5rem]"
                          >
                            {k}
                          </kbd>
                        ))}
                        {altKeys && (
                          <>
                            <span className="text-slate-400 dark:text-slate-500 text-xs px-0.5">/</span>
                            {altKeys.map(k => (
                              <kbd
                                key={k}
                                className="inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 text-xs font-mono shadow-[0_1px_0_#cbd5e1] dark:shadow-[0_1px_0_#475569] text-slate-700 dark:text-slate-300 min-w-[1.5rem]"
                              >
                                {k}
                              </kbd>
                            ))}
                          </>
                        )}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{description}</span>
                    </div>
                  )
              ))}
              <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">Book navigation shortcuts work on the Tracker page.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
