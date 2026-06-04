import { authHeaders } from './auth'

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
