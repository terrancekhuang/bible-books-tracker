import { Link, useLocation } from 'react-router-dom'
import { MoonIcon, SunIcon, HomeIcon, BookOpenIcon } from './Icons'
import UserMenu from './UserMenu'

interface NavBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogout: () => void
  pictureUrl?: string | null
  userName?: string | null
}

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/tracker', label: 'Tracker' },
]

const MOBILE_TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/tracker', label: 'Tracker', Icon: BookOpenIcon },
]

export default function NavBar({ theme, onToggleTheme, onLogout, pictureUrl, userName }: NavBarProps) {
  const { pathname } = useLocation()

  return (
    <>
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 py-3 max-w-7xl mx-auto">
          <Link
            to="/"
            className="text-xl font-bold text-indigo-700 dark:text-indigo-400 tracking-tight shrink-0"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            Bible Books Tracker
          </Link>

          <nav className="hidden md:flex items-center gap-1 mx-6">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={[
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <UserMenu
              pictureUrl={pictureUrl}
              userName={userName}
              onLogout={onLogout}
              showProfileLink={pathname !== '/profile'}
            />
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="flex">
          {MOBILE_TABS.map(({ to, label, Icon }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={[
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
                ].join(' ')}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
