import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import { getToken, isGuestToken, onTokenChange, setToken } from './auth'
import { clearPersistedCache } from './queryClient'

interface AuthContextValue {
  jwt: string | null
  /** True for visitors and guests alike — anyone not signed in with Google. */
  isGuest: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Subscribed rather than held in state: a guest's token is minted by the first write,
  // deep in api.ts, and the app has to notice it without that write knowing about React.
  const jwt = useSyncExternalStore(onTokenChange, getToken)

  const login = useCallback((token: string) => {
    // Whatever was cached belonged to the visitor or guest before this account.
    clearPersistedCache()
    setToken(token)
  }, [])

  const logout = useCallback(() => {
    // The cache outlives the session otherwise — it is persisted to localStorage, so the
    // next account to sign in on this browser would be shown the previous one's books,
    // stats and name until its own requests came back.
    clearPersistedCache()
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ jwt, isGuest: isGuestToken(jwt), login, logout }}>
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
