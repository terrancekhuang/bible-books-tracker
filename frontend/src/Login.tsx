import { GoogleLogin } from '@react-oauth/google'

interface LoginProps {
  onLoginSuccess: (token: string) => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    const googleToken = credentialResponse.credential
    if (!googleToken) return

    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: googleToken }),
    })

    if (!res.ok) {
      console.error('Auth failed:', await res.text())
      return
    }

    const data = await res.json()
    onLoginSuccess(data.access_token)
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-white dark:bg-slate-900">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Bible Books Tracker</h1>
      <p className="text-lg text-slate-500 dark:text-slate-400">Sign in to track your reading progress</p>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => console.error('Google login failed')}
      />
    </div>
  )
}
