import { Link, useLocation } from 'react-router-dom'
import { MoonIcon, SunIcon, HomeIcon, BookOpenIcon } from './Icons'
import { useTheme } from '../lib/ThemeContext'
import UserMenu from './UserMenu'

interface NavBarProps {
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

const BLUR = { backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)' }

const navStyleLight = { ...BLUR, background: 'rgba(255,255,255,0.82)', borderBottom: '1px solid rgba(100,130,255,0.12)' }
const navStyleDark  = { ...BLUR, background: 'rgba(6,12,30,0.65)',      borderBottom: '1px solid rgba(150,175,255,0.08)' }
const mobileNavLight = { ...BLUR, background: 'rgba(255,255,255,0.88)', borderTop: '1px solid rgba(100,130,255,0.1)' }
const mobileNavDark  = { ...BLUR, background: 'rgba(6,12,30,0.8)',      borderTop: '1px solid rgba(150,175,255,0.08)' }

export default function NavBar({ pictureUrl, userName }: NavBarProps) {
  const { pathname } = useLocation()
  const { theme, isDark, toggle } = useTheme()
  const style = isDark ? navStyleDark : navStyleLight

  const secondaryText = isDark ? 'rgba(195,210,255,0.6)' : 'rgba(13,21,51,0.5)'
  const activeText = isDark ? '#dde6ff' : '#0d1533'
  const activeBg = isDark ? 'rgba(150,175,255,0.1)' : 'rgba(100,130,255,0.1)'

  return (
    <>
      <header className="sticky top-0 z-40" style={style}>
        <div className="flex md:grid md:grid-cols-3 items-center px-5 py-3 max-w-7xl mx-auto w-full">
          <Link
            to="/"
            className="text-base md:text-xl font-semibold tracking-widest shrink-0 whitespace-nowrap md:justify-self-start"
            style={{ fontFamily: "'Cinzel', serif", color: isDark ? '#dde6ff' : '#0d1533' }}
          >
            Bible Books Tracker
          </Link>

          <nav className="hidden md:flex items-center justify-center gap-1">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    fontFamily: "'Raleway', sans-serif",
                    color: isActive ? activeText : secondaryText,
                    background: isActive ? activeBg : 'transparent',
                    letterSpacing: '0.04em',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3 ml-auto md:ml-0 md:justify-self-end leading-[0]">
            <button
              onClick={toggle}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: secondaryText }}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <UserMenu
              pictureUrl={pictureUrl}
              userName={userName}
              showProfileLink={pathname !== '/profile'}
            />
          </div>
        </div>
      </header>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={isDark ? mobileNavDark : mobileNavLight}
      >
        <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {MOBILE_TABS.map(({ to, label, Icon }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
                style={{ color: isActive ? (isDark ? '#dde6ff' : '#0d1533') : secondaryText }}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium" style={{ fontFamily: "'Raleway', sans-serif", letterSpacing: '0.05em' }}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
