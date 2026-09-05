interface TourWelcomePromptProps {
  onStart: () => void
  onDismiss: () => void
}

export default function TourWelcomePrompt({ onStart, onDismiss }: TourWelcomePromptProps) {
  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
        className="fixed inset-0 flex items-center justify-center z-50 px-4"
        style={{ background: 'rgba(0,0,0,0.55)', animation: 'tourWelcomeFadeIn 0.2s ease forwards' }}
        onClick={onDismiss}
      >
        <div
          className="rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center"
          style={{
            background: 'var(--color-shelf)',
            border: '1px solid var(--color-shelf-lit)',
            animation: 'tourWelcomeSlideUp 0.25s cubic-bezier(0.32,0.72,0,1) forwards',
          }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: 26 }}>✦</p>
          <h2 className="slab text-lg font-semibold mt-2" style={{ color: 'var(--color-gilt)' }}>
            Welcome to Bible Books Tracker
          </h2>
          <p className="text-sm mt-2" style={{ color: 'rgba(242,236,221,0.7)', lineHeight: 1.5 }}>
            Want a quick tour of the shelf, your streak, and how to log a chapter?
          </p>
          <div className="flex flex-col gap-2 mt-5">
            <button
              onClick={onStart}
              className="text-xs font-semibold uppercase px-4 py-2.5 rounded-lg transition-colors"
              style={{ letterSpacing: '0.08em', background: 'var(--color-gilt)', color: 'var(--color-shelf)' }}
            >
              Start the tour
            </button>
            <button
              onClick={onDismiss}
              className="text-xs font-medium py-1.5"
              style={{ color: 'rgba(242,236,221,0.5)' }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourWelcomeFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tourWelcomeSlideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </>
  )
}
