import { createContext, useCallback, useContext, useState } from 'react'
import { getToken, TOKEN_KEY } from './auth'

interface AuthContextValue {
  jwt: string | null
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [jwt, setJwt] = useState<string | null>(getToken)

  const login = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    setJwt(token)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setJwt(null)
  }, [])

  return (
    <AuthContext.Provider value={{ jwt, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
