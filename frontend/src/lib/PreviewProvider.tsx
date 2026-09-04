import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { SyncProvider } from './SyncContext'

export function PreviewProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SyncProvider>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </SyncProvider>
    </AuthProvider>
  )
}
