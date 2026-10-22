import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react'
import { getToken, isGuestToken, onTokenChange, setToken } from './auth'
import { clearPersistedCache } from './queryClient'

/** Why the sign-in popup is open: a guest choosing to sign in, or a signed-in session that expired. */
export type SignInReason = 'save' | 'expired'

interface AuthContextValue {
  jwt: string | null
  /** True for visitors and guests alike — anyone not signed in with Google. */
  isGuest: boolean
  login: (token: string) => void
  /**
   * The session was rejected (any 401). A guest quietly starts over as a visitor; a signed-in
   * user becomes a visitor too, but is offered the sign-in popup to get back in.
   */
  logout: () => void
  /** The user chose to sign out. */
  signOut: () => void
  signInReason: SignInReason | null
  openSignIn: (reason: SignInReason) => void
  closeSignIn: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Subscribed rather than held in state: a guest's token is minted by the first write,
  // deep in api.ts, and the app has to notice it without that write knowing about React.
  const jwt = useSyncExternalStore(onTokenChange, getToken)
  const [signInReason, setSignInReason] = useState<SignInReason | null>(null)

  const login = useCallback((token: string) => {
    // Whatever was cached belonged to the visitor or guest before this account.
    clearPersistedCache()
    setToken(token)
  }, [])

  const signOut = useCallback(() => {
    // The cache outlives the session otherwise — it is persisted to localStorage, so the
    // next account to sign in on this browser would be shown the previous one's books,
    // stats and name until its own requests came back.
    clearPersistedCache()
    setToken(null)
  }, [])

  const logout = useCallback(() => {
    if (!isGuestToken(getToken())) setSignInReason('expired')
    signOut()
  }, [signOut])

  const closeSignIn = useCallback(() => setSignInReason(null), [])

  return (
    <AuthContext.Provider value={{
      jwt, isGuest: isGuestToken(jwt), login, logout, signOut,
      signInReason, openSignIn: setSignInReason, closeSignIn,
    }}>
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
