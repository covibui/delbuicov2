'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

async function errorText(res: Response, fallback: string) {
  try {
    const j = await res.json()
    return j?.errors?.[0]?.message || j?.message || fallback
  } catch {
    return fallback
  }
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login')

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setBusy(false)
    if (!res.ok) {
      setError('That email and password don’t match. Try again, or reset your password.')
      return
    }
    router.push(next.startsWith('/') ? next : '/')
    router.refresh()
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/users/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setBusy(false)
    if (!res.ok) setError(await errorText(res, 'Something went wrong. Try again.'))
    else setMode('sent')
  }

  if (mode === 'sent') {
    return (
      <div className="notice notice--ok">
        If that email is in the family list, a link to set a new password is on its way. Check your inbox (and spam).
      </div>
    )
  }

  return (
    <form onSubmit={mode === 'login' ? login : forgot}>
      {error ? <div className="notice notice--error">{error}</div> : null}
      <label className="field">
        <span>Email</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {mode === 'login' ? (
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      ) : null}
      <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Email me a link'}
      </button>
      <p style={{ textAlign: 'center', marginTop: 18, fontSize: 16 }}>
        <button type="button" className="linkish" onClick={() => setMode(mode === 'login' ? 'forgot' : 'login')}>
          {mode === 'login' ? 'Forgot your password?' : 'Back to log in'}
        </button>
      </p>
    </form>
  )
}

export function SetPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    setError('')
    const res = await fetch('/api/users/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    setBusy(false)
    if (!res.ok) {
      setError('This link has expired or was already used. Ask Bri to resend your invite, or use “Forgot your password?”.')
      return
    }
    router.push('/')
    router.refresh()
  }

  if (!token) return <div className="notice notice--error">This link is missing its code. Open it again from the email.</div>

  return (
    <form onSubmit={submit}>
      {error ? <div className="notice notice--error">{error}</div> : null}
      <label className="field">
        <span>New password</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="hint">At least 8 characters.</span>
      </label>
      <label className="field">
        <span>Type it again</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Saving…' : 'Save and log in'}
      </button>
    </form>
  )
}

export function AccountForm({ id, name: initialName, email }: { id: number; name: string; email: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setBusy(false)
    setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: await errorText(res, 'Could not save.') })
    router.refresh()
  }

  async function resetPassword() {
    await fetch('/api/users/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setMsg({ ok: true, text: `A link to change your password was sent to ${email}.` })
  }

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={save}>
      {msg ? <div className={`notice ${msg.ok ? 'notice--ok' : 'notice--error'}`}>{msg.text}</div> : null}
      <label className="field">
        <span>Your name (shown on your recipes)</span>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" value={email} disabled />
      </label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" type="submit" disabled={busy}>
          Save
        </button>
        <button className="btn btn--ghost" type="button" onClick={resetPassword}>
          Change password
        </button>
        <button className="btn btn--ghost" type="button" onClick={logout}>
          Log out
        </button>
      </div>
    </form>
  )
}
