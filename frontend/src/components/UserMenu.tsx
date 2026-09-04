import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'

interface UserMenuProps {
  pictureUrl?: string | null
  userName?: string | null
}

export default function UserMenu({ pictureUrl, userName }: UserMenuProps) {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const initials = userName ? userName[0].toUpperCase() : '?'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full overflow-hidden transition-opacity hover:opacity-80"
        style={{ outline: 'none', boxShadow: open ? '0 0 0 2px rgba(210,166,63,0.6)' : 'none' }}
        title="Account"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {pictureUrl ? (
          <img src={pictureUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--color-shelf-lit)', color: 'var(--color-gilt)' }}
          >
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-xl py-1 z-50"
          style={{
            background: 'var(--color-shelf)',
            border: '1px solid var(--color-shelf-lit)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm transition-colors"
            style={{ color: 'rgba(242,236,221,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,166,63,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { setOpen(false); logout() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
