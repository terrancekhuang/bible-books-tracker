import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UserMenuProps {
  pictureUrl?: string | null
  userName?: string | null
  onLogout: () => void
  showProfileLink?: boolean
}

export default function UserMenu({ pictureUrl, userName, onLogout, showProfileLink = true }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
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
        className="w-8 h-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-opacity hover:opacity-80"
        title="Account"
      >
        {pictureUrl ? (
          <img src={pictureUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1 z-50">
          {showProfileLink && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => { setOpen(false); navigate('/profile') }}
            >
              Profile
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            onClick={() => { setOpen(false); onLogout() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
