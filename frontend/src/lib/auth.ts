export const TOKEN_KEY = 'app_jwt'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

const listeners = new Set<() => void>()

/** The one writer of the token, so AuthContext hears about guests created outside React. */
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  listeners.forEach(l => l())
}

export function onTokenChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** A visitor (no token) or a guest (a token minted by `/auth/guest`) — anyone not signed in with Google. */
export function isGuestToken(token: string | null): boolean {
  if (!token) return true
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).guest === true
  } catch {
    return false
  }
}

let pendingGuest: Promise<void> | null = null

/**
 * Called before every write. A visitor has no account until they first save something;
 * this creates their guest account then. Concurrent first writes share the one request.
 * Rejects with fetch's TypeError when offline, which the callers already treat as "queue it".
 */
export function ensureSession(): Promise<void> {
  if (getToken()) return Promise.resolve()
  pendingGuest ??= (async () => {
    const res = await fetch('/auth/guest', { method: 'POST' })
    if (!res.ok) throw new Error('Could not start a guest session')
    setToken((await res.json()).access_token)
  })().finally(() => { pendingGuest = null })
  return pendingGuest
}

export function authHeaders(): HeadersInit {
  const token = getToken()
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

/**
 * The backend renews a signed-in token more than a day old in `X-Access-Token`. Adopted only
 * while still signed in, so a response landing after Sign out can't bring the session back.
 */
export function adoptRefreshedToken(res: Response): void {
  const renewed = res.headers.get('X-Access-Token')
  const current = getToken()
  if (renewed && current && !isGuestToken(current)) setToken(renewed)
}
