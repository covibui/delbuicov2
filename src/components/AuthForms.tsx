'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

async function errorText(res: Response, fallback: string) {
  try {
    const j = await res.json()
    return j?.errors?.[0]?.data?.errors?.[0]?.message || j?.errors?.[0]?.message || j?.message || fallback
  } catch {
    return fallback
  }
}

export function LoginForm() {
  const router = useRouter()
  const next = useSearchParams().get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      setError('That email and password don’t match. Try again.')
      return
    }
    router.push(next.startsWith('/') ? next : '/')
    router.refresh()
  }

  return (
    <form onSubmit={login}>
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
      <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'One moment…' : 'Log in'}
      </button>
      <p className="hint" style={{ textAlign: 'center', marginTop: 18, fontSize: 16, fontStyle: 'italic', color: 'var(--muted)' }}>
        Forgot your password, or don’t have an account? Ask Bri.
      </p>
    </form>
  )
}

export function AccountForm({ id, name: initialName, email }: { id: number; name: string; email: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  async function saveName(e: React.FormEvent) {
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

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (next.length < 8) return setPwMsg({ ok: false, text: 'Use at least 8 characters for the new password.' })
    if (next !== confirm) return setPwMsg({ ok: false, text: 'The two new passwords don’t match.' })
    setPwBusy(true)
    try {
      // Check the current password first.
      const check = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: current }),
      })
      if (!check.ok) throw new Error('Your current password isn’t right.')
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: next }),
      })
      if (!res.ok) throw new Error(await errorText(res, 'Could not change the password.'))
      // Log in again with the new password so this device stays signed in.
      await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: next }),
      })
      setCurrent('')
      setNext('')
      setConfirm('')
      setPwMsg({ ok: true, text: 'Password changed.' })
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change the password.' })
    } finally {
      setPwBusy(false)
    }
  }

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <form onSubmit={saveName}>
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
            Save name
          </button>
          <button className="btn btn--ghost" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </form>

      <form onSubmit={changePassword} style={{ marginTop: 40 }}>
        <h2 className="block-title" style={{ fontSize: 26 }}>
          Change password
        </h2>
        <div className="double-rule" />
        {pwMsg ? <div className={`notice ${pwMsg.ok ? 'notice--ok' : 'notice--error'}`}>{pwMsg.text}</div> : null}
        <label className="field">
          <span>Current password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <span className="hint">At least 8 characters.</span>
        </label>
        <label className="field">
          <span>New password again</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button className="btn" type="submit" disabled={pwBusy}>
          {pwBusy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </>
  )
}
