import { authHeaders } from './auth'

export type FetchResult<T> = { ok: true; data: T } | { ok: false; unauthorized: boolean }

/** GET + parse JSON, with the shared session-expiry (401) handling every authenticated fetch needs. */
export async function fetchJson<T>(url: string, onUnauthorized: () => void): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, { headers: authHeaders() })
    if (res.status === 401) { onUnauthorized(); return { ok: false, unauthorized: true } }
    if (!res.ok) return { ok: false, unauthorized: false }
    return { ok: true, data: await res.json() as T }
  } catch {
    return { ok: false, unauthorized: false }
  }
}

async function post(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: authHeaders() as Record<string, string>,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
}

async function put(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'PUT',
    headers: authHeaders() as Record<string, string>,
    body: JSON.stringify(body),
  })
}

export const api = {
  progress: {
    submit: (bookName: string, chapters: number[]) =>
      post('/api/progress', { book_name: bookName, chapters }),
    undo: (bookName: string) =>
      post('/api/progress/undo', { book_name: bookName }),
    reset: (bookName: string) =>
      post('/api/progress/reset', { book_name: bookName }),
  },
  cycles: {
    create: () => post('/api/cycles'),
  },
  settings: {
    update: (weeklyGoal: number) => put('/api/settings', { weekly_goal: weeklyGoal }),
  },
}
