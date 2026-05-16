export const TOKEN_KEY = 'app_jwt'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function authHeaders(): HeadersInit {
  const token = getToken()
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}
