import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/AuthContext'
import { SyncProvider } from './lib/SyncContext'
import {
  queryClient,
  persister,
  dehydrateOptions,
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
} from './lib/queryClient'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

// Dev only. `import.meta.env.DEV` is a compile-time constant, so in a production build
// the ternary folds to null and Rollup drops the dynamic import entirely — no devtools
// code and no devtools chunk ship to users.
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : null

// One-time cleanup of the localStorage keys the pre-TanStack cache layer wrote. Safe to
// delete once every install has loaded the app at least once after this release.
function removeLegacyCacheKeys(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('cache:')) localStorage.removeItem(key)
    }
  } catch { /* ignore */ }
}

function render(): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <BrowserRouter>
            <AuthProvider>
              <SyncProvider>
                <App />
              </SyncProvider>
            </AuthProvider>
          </BrowserRouter>
        </GoogleOAuthProvider>
        {Devtools && (
          <Suspense fallback={null}>
            <Devtools initialIsOpen={false} buttonPosition="bottom-left" />
          </Suspense>
        )}
      </QueryClientProvider>
    </StrictMode>,
  )
}

removeLegacyCacheKeys()

// Restore *before* the first render, so the first frame the browser paints already has
// last-known books/stats/cycles — the way the old synchronous localStorage reads did.
// PersistQueryClientProvider would restore in a useEffect, i.e. after the first commit,
// which paints a frame of skeletons first.
//
// `.finally`, not `.then`: a corrupt or unreadable persisted cache must still render the
// app rather than leave a white page.
persistQueryClientRestore({
  queryClient,
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster: PERSIST_BUSTER,
}).finally(() => {
  // maxAge is a restore-time concern only — saving stamps the cache with `now`.
  persistQueryClientSubscribe({ queryClient, persister, buster: PERSIST_BUSTER, dehydrateOptions })
  render()
})
