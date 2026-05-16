import { useLayoutEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { TOKEN_KEY, getToken } from './lib/auth'
import Login from './Login'
import Profile from './Profile'
import Tracker from './components/Tracker'

export default function App() {
  const [jwt, setJwt] = useState<string | null>(getToken)
  const navigate = useNavigate()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    setJwt(token)
    navigate('/')
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setJwt(null)
    navigate('/login')
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={jwt ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
      />
      <Route
        path="/"
        element={jwt ? <Tracker onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/profile"
        element={jwt ? <Profile onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}
