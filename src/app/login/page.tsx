'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const next = params.get('next')
        router.push(next && next.startsWith('/') ? next : '/dashboard')
      } else {
        setError('Wrong password')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-lg mb-5">I</div>
        <h1 className="text-white font-semibold text-xl">irfaninvest analytics</h1>
        <p className="text-white/35 text-sm mt-1 mb-6">Enter the dashboard password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/[0.1] text-white text-sm placeholder-white/25 outline-none focus:border-violet-500/60 transition-colors"
        />
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-5 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {loading ? 'Checking…' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
