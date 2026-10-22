import { describe, it, expect, afterEach, vi } from 'vitest'
import { adoptRefreshedToken, getToken } from '../auth'

const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims))}.s`
const renewedBy = (token: string) => ({ headers: new Headers({ 'X-Access-Token': token }) }) as Response

function stubToken(token: string | null): void {
  const store = new Map<string, string>(token ? [['app_jwt', token]] : [])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('adoptRefreshedToken', () => {
  it('swaps in the renewed token for a signed-in user', () => {
    stubToken(jwt({ sub: '1' }))
    adoptRefreshedToken(renewedBy('renewed'))
    expect(getToken()).toBe('renewed')
  })

  it('does not bring a session back after Sign out', () => {
    stubToken(null)
    adoptRefreshedToken(renewedBy('renewed'))
    expect(getToken()).toBeNull()
  })

  it('leaves a guest token alone', () => {
    const guest = jwt({ sub: '2', guest: true })
    stubToken(guest)
    adoptRefreshedToken(renewedBy('renewed'))
    expect(getToken()).toBe(guest)
  })
})
