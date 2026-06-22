import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext'
import { AuthProvider } from './AuthContext'
import { SyncProvider } from './SyncContext'

export function PreviewProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <MemoryRouter>
            {children}
          </MemoryRouter>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
