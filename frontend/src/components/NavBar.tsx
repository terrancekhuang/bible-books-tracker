import { Link, useLocation } from 'react-router-dom'
import { HomeIcon, BookOpenIcon, UserIcon } from './Icons'
import UserMenu from './UserMenu'
import SyncIndicator from './SyncIndicator'

interface NavBarProps {
  pictureUrl?: string | null
  userName?: string | null
}

const NAV_LINKS = [
  { to: '/tracker', label: 'Tracker' },
  { to: '/', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
]

const MOBILE_TABS = [
  { to: '/tracker', label: 'Tracker', Icon: BookOpenIcon },
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
]

const MUTED_LEAF = 'rgba(242,236,221,0.55)'

export default function NavBar({ pictureUrl, userName }: NavBarProps) {
  const { pathname } = useLocation()

  return (
    <>
      <header
        className="sticky top-0 z-40"
        style={{ background: 'var(--color-shelf)', borderBottom: '1px solid rgba(210,166,63,0.6)' }}
      >
        <div className="flex md:grid md:grid-cols-3 items-center px-5 py-3 max-w-7xl mx-auto w-full">
          <Link
            to="/"
            className="slab text-base md:text-lg shrink-0 whitespace-nowrap md:justify-self-start"
            style={{ color: 'var(--color-gilt)', letterSpacing: '0.02em' }}
          >
            Bible Books Tracker
          </Link>

          <nav className="hidden md:flex items-center justify-center gap-6">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className="text-xs font-semibold uppercase transition-colors"
                  style={{
                    color: isActive ? 'var(--color-gilt)' : MUTED_LEAF,
                    letterSpacing: '0.08em',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3 ml-auto md:ml-0 md:justify-self-end leading-[0]">
            <SyncIndicator secondaryText={MUTED_LEAF} />
            <UserMenu pictureUrl={pictureUrl} userName={userName} />
          </div>
        </div>
      </header>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{ background: 'var(--color-shelf)', borderTop: '1px solid rgba(210,166,63,0.5)' }}
      >
        <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {MOBILE_TABS.map(({ to, label, Icon }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
                style={{ color: isActive ? 'var(--color-gilt)' : MUTED_LEAF }}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium" style={{ letterSpacing: '0.05em' }}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
