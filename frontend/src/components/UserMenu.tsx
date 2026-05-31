import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UserMenuProps {
  pictureUrl?: string | null
  userName?: string | null
  onLogout: () => void
  showProfileLink?: boolean
  theme?: 'light' | 'dark'
}

export default function UserMenu({ pictureUrl, userName, onLogout, showProfileLink = true, theme }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const isDark = theme === 'dark'

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
        style={{ outline: 'none', boxShadow: open ? `0 0 0 2px ${isDark ? 'rgba(150,175,255,0.5)' : 'rgba(13,21,51,0.25)'}` : 'none' }}
        title="Account"
      >
        {pictureUrl ? (
          <img src={pictureUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm font-bold"
            style={{
              background: isDark ? 'rgba(150,175,255,0.15)' : 'rgba(13,21,51,0.1)',
              color: isDark ? '#aabfff' : '#0d1533',
              fontFamily: "'Raleway', sans-serif",
            }}
          >
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-44 rounded-xl py-1 z-50"
          style={{
            background: isDark ? 'rgba(13,21,51,0.92)' : 'rgba(250,244,228,0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: isDark ? '1px solid rgba(150,175,255,0.12)' : '1px solid rgba(180,140,60,0.18)',
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          {showProfileLink && (
            <button
              className="w-full text-left px-4 py-2 text-sm transition-colors"
              style={{
                fontFamily: "'Raleway', sans-serif",
                color: isDark ? 'rgba(195,210,255,0.8)' : 'rgba(13,21,51,0.8)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setOpen(false); navigate('/profile') }}
            >
              Profile
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm transition-colors"
            style={{
              fontFamily: "'Raleway', sans-serif",
              color: isDark ? 'rgba(195,210,255,0.8)' : 'rgba(13,21,51,0.8)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { setOpen(false); onLogout() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
