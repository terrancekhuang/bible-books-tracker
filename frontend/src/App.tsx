import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { useAuth } from './lib/AuthContext'
import { useKeyChord } from './lib/useKeyChord'
import { useMediaQuery } from './lib/useMediaQuery'
import { useTour } from './lib/useTour'
import Profile from './Profile'
import Tracker from './components/Tracker'
import Dashboard from './Dashboard'
import NotFound from './NotFound'
import PWAInstallModal from './components/PWAInstallModal'
import TourOverlay from './components/TourOverlay'
import TourWelcomePrompt from './components/TourWelcomePrompt'
import HelpMenu from './components/HelpMenu'
import SignInDialog from './components/SignInDialog'
import { shouldShowPWAPrompt } from './lib/pwa'
import { shouldShowTourPrompt, markTourSeen } from './lib/tour'
import { TooltipGroupProvider } from './lib/TooltipGroupContext'

export default function App() {
  const { jwt } = useAuth()
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const [showHelp, setShowHelp] = useState(false);
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)'); // Tailwind's `md:` breakpoint
  const tour = useTour();
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
    window.scrollTo(0, 0)
  }, [location.pathname]);

  // The tour is offered on a visitor's first visit, when it's most useful. The PWA prompt
  // waits for the moment a session begins (not a page refresh): a visitor's first save
  // minting their guest account, or a Google sign-in — by then the tour prompt is resolved.
  useEffect(() => {
    if (!shouldShowTourPrompt()) return
    const t = setTimeout(() => setShowTourPrompt(true), 0)
    return () => clearTimeout(t)
  }, [])

  const prevJwtRef = useRef<string | null>(jwt)
  useEffect(() => {
    const prev = prevJwtRef.current
    prevJwtRef.current = jwt
    if (!jwt || prev || !shouldShowPWAPrompt()) return
    const t = setTimeout(() => setShowPwaPrompt(true), 0)
    return () => clearTimeout(t)
  }, [jwt])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tour.active) return;
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
      if (!isInput && (e.key === 'h' || e.key === 't' || e.key === 'p') && consumeGChord()) {
        e.preventDefault();
        if (e.key === 'h') navigate('/');
        else if (e.key === 't') navigate('/tracker');
        else navigate('/profile');
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showHelp, navigate, armGChord, consumeGChord, tour.active]);

  return (
    <TooltipGroupProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SignInDialog />

      {showPwaPrompt && (
        <PWAInstallModal
          onDismiss={() => setShowPwaPrompt(false)}
        />
      )}

      {showTourPrompt && (
        <TourWelcomePrompt
          onStart={() => { markTourSeen(); setShowTourPrompt(false); tour.start() }}
          onDismiss={() => { markTourSeen(); setShowTourPrompt(false) }}
        />
      )}

      {tour.active && <TourOverlay tour={tour} />}

      {showUpdateBanner && (
        <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-4 py-3 text-sm"
          style={{ background: 'var(--color-shelf)', borderTop: '1px solid var(--color-shelf-lit)', color: 'var(--color-leaf)' }}
        >
          <span>A new version is available.</span>
          <div className="flex gap-2">
            <button
              onClick={() => { updateSwRef.current?.(true); }}
              className="px-3 py-1 rounded font-medium text-xs"
              style={{ background: 'var(--color-gilt)', color: 'var(--color-shelf)' }}
            >
              Reload
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="px-3 py-1 rounded text-xs"
              style={{ background: 'var(--color-shelf-lit)', color: 'rgba(242,236,221,0.7)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <HelpMenu
        isMobile={isMobile}
        showShortcuts={showHelp}
        onOpenShortcuts={() => setShowHelp(true)}
        onCloseShortcuts={() => setShowHelp(false)}
        onReplayTour={() => tour.start()}
      />
    </TooltipGroupProvider>
  )
}
