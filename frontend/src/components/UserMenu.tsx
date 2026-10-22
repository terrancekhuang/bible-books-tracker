import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { UserIcon } from './Icons'

interface UserMenuProps {
  pictureUrl?: string | null
  userName?: string | null
}

export default function UserMenu({ pictureUrl, userName }: UserMenuProps) {
  const { isGuest, signOut, openSignIn } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)

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
        ref={avatarRef}
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full overflow-hidden transition-opacity hover:opacity-80"
        style={{ outline: 'none', boxShadow: open ? '0 0 0 2px rgba(210,166,63,0.6)' : 'none' }}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {isGuest ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--color-shelf-lit)', color: 'var(--color-gilt)' }}
          >
            <UserIcon size={16} />
          </div>
        ) : pictureUrl ? (
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
          className="absolute right-0 mt-2 w-48 rounded-xl py-1 z-50"
          style={{
            background: 'var(--color-shelf)',
            border: '1px solid var(--color-shelf-lit)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {isGuest && (
            <p className="px-4 pt-2 pb-1 text-xs font-semibold" style={{ color: 'var(--color-gilt)' }}>
              Guest
            </p>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm transition-colors"
            style={{ color: 'rgba(242,236,221,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,166,63,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              setOpen(false)
              if (!isGuest) return signOut()
              // The menu item unmounts; the popup hands focus back to whatever had it on open.
              avatarRef.current?.focus()
              openSignIn('save')
            }}
          >
            {isGuest ? 'Sign in with Google' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
