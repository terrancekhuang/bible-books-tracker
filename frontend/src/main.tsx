import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/AuthContext'
import { SyncProvider } from './lib/SyncContext'
import { BooksProvider } from './lib/BooksContext'
import { ThemeProvider } from './lib/ThemeContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <SyncProvider>
            <BooksProvider>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </BooksProvider>
          </SyncProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
