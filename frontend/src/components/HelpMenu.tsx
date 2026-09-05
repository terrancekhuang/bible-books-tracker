import { useEffect, useRef, useState } from 'react'

interface HelpMenuProps {
  isMobile: boolean
  showShortcuts: boolean
  onOpenShortcuts: () => void
  onCloseShortcuts: () => void
  onReplayTour: () => void
}

export default function HelpMenu({ isMobile, showShortcuts, onOpenShortcuts, onCloseShortcuts, onReplayTour }: HelpMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <>
      <div ref={menuRef} className="fixed bottom-20 md:bottom-5 right-5 z-40">
        {menuOpen && (
          <div
            className="absolute bottom-full right-0 mb-2 rounded-xl py-1 w-48"
            style={{
              background: 'var(--color-shelf)',
              border: '1px solid var(--color-shelf-lit)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {!isMobile && (
              <button
                className="w-full text-left px-4 py-2 text-sm transition-colors"
                style={{ color: 'rgba(242,236,221,0.8)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,166,63,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setMenuOpen(false); onOpenShortcuts() }}
              >
                Keyboard Shortcuts
              </button>
            )}
            <button
              className="w-full text-left px-4 py-2 text-sm transition-colors"
              style={{ color: 'rgba(242,236,221,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,166,63,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setMenuOpen(false); onReplayTour() }}
            >
              Replay App Tour
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(v => !v)}
          title="Help"
          aria-label="Help"
          aria-expanded={menuOpen}
          className="flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-all select-none font-bold text-sm"
          style={{
            background: 'var(--color-shelf)',
            border: '1px solid var(--color-shelf-lit)',
            color: 'var(--color-gilt)',
          }}
        >
          ?
        </button>
      </div>

      {!isMobile && showShortcuts && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={onCloseShortcuts}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            style={{
              background: 'var(--color-shelf)',
              border: '1px solid var(--color-shelf-lit)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                className="slab text-base font-semibold"
                style={{ letterSpacing: '0.06em', color: 'var(--color-gilt)' }}
              >
                Keyboard Shortcuts
              </h2>
              <button
                onClick={onCloseShortcuts}
                className="text-xl leading-none transition-colors"
                style={{ color: 'rgba(242,236,221,0.5)' }}
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {([
                { keys: ['g', 'h'], description: 'Go to Dashboard' },
                { keys: ['g', 't'], description: 'Go to Tracker' },
                { keys: ['g', 'p'], description: 'Go to Profile' },
                { keys: null, description: '' },
                { keys: ['/'], description: 'Focus search' },
                { keys: ['←', '→'], altKeys: ['h', 'l'], description: 'Switch volume' },
                { keys: ['↑', '↓'], altKeys: ['k', 'j'], description: 'Navigate entries' },
                { keys: ['Tab'], altKeys: ['i'], description: 'Focus chapter input' },
                { keys: ['Enter'], description: 'Submit progress' },
                { keys: ['u'], description: 'Undo last entry' },
                { keys: ['R'], description: 'Reset all progress (two-step)' },
                { keys: ['A'], description: 'Mark all chapters as read (two-step)' },
                { keys: ['Esc'], description: 'Deselect / clear search' },
                { keys: ['?'], description: 'Show / hide this help' },
              ] as { keys: string[] | null; altKeys?: string[]; description: string }[]).map(({ keys, altKeys, description }, i) => (
                keys === null
                  ? <div key={i} className="border-t my-1" style={{ borderColor: 'var(--color-shelf-lit)' }} />
                  : (
                    <div key={description} className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {keys.map(k => (
                          <kbd
                            key={k}
                            className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-mono min-w-[1.5rem]"
                            style={{ background: 'var(--color-shelf-lit)', border: '1px solid rgba(210,166,63,0.3)', color: 'var(--color-leaf)' }}
                          >
                            {k}
                          </kbd>
                        ))}
                        {altKeys && (
                          <>
                            <span className="text-xs px-0.5" style={{ color: 'rgba(242,236,221,0.35)' }}>/</span>
                            {altKeys.map(k => (
                              <kbd
                                key={k}
                                className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-mono min-w-[1.5rem]"
                                style={{ background: 'var(--color-shelf-lit)', border: '1px solid rgba(210,166,63,0.3)', color: 'var(--color-leaf)' }}
                              >
                                {k}
                              </kbd>
                            ))}
                          </>
                        )}
                      </div>
                      <span className="text-sm" style={{ color: 'rgba(242,236,221,0.6)' }}>{description}</span>
                    </div>
                  )
              ))}
              <p className="text-xs pt-1" style={{ color: 'rgba(242,236,221,0.35)' }}>Book navigation shortcuts work on the Tracker page.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
