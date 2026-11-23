'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/** Sign-in panel from the design's "Account" board. No email service, so "Forgot password" points to Bri. */
export function LoginForm() {
  const router = useRouter()
  const next = useSearchParams().get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [forgot, setForgot] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(false)
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setBusy(false)
    if (!res.ok) {
      setError(true)
      return
    }
    router.push(next.startsWith('/') && !next.startsWith('/login') ? next : '/')
    router.refresh()
  }

  if (forgot) {
    return (
      <>
        <button type="button" className="btn btn--link" style={{ alignSelf: 'flex-start', color: 'var(--ink-2)' }} onClick={() => setForgot(false)}>
          ← Back to sign in
        </button>
        <h2>Forgot your password?</h2>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          Ask Bri. She can set a new one for you from the admin panel, and you can change it on your account page after
          you sign in.
        </p>
      </>
    )
  }

  return (
    <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2>Sign in</h2>
      {error ? (
        <div role="alert" className="alert">
          That email and password don’t match. Check for typos, or ask Bri to reset your password.
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="si-email" className="lbl">
          Email
        </label>
        <input
          id="si-email"
          className="fld"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="si-pass" className="lbl">
          Password
        </label>
        <input
          id="si-pass"
          className="fld"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error || undefined}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(false)
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" type="submit" disabled={busy} style={{ minHeight: 50, padding: '0 30px' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn btn--link" onClick={() => setForgot(true)}>
          Forgot password
        </button>
      </div>
      <p className="muted-i" style={{ margin: 0 }}>
        No account? Ask Bri. There’s no public sign-up.
      </p>
    </form>
  )
}
