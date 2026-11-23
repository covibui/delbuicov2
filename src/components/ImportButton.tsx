'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ImportButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function run() {
    setState('busy')
    setMsg('')
    try {
      const res = await fetch('/api/import-old-site', { method: 'POST', credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Import failed.')
      const r = j.result
      setState('done')
      setMsg(`Imported ${r.recipes} recipes, ${r.chapters} chapters and ${r.users} family accounts.`)
      router.refresh()
    } catch (err) {
      setState('error')
      setMsg(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  return (
    <div className="draft-card" style={{ marginTop: 26, flexDirection: 'column', alignItems: 'flex-start' }}>
      <p style={{ marginTop: 0 }}>
        <strong>One-time step:</strong> bring in the 59 recipes, 24 chapters and the original authors from the old site.
        Takes about a minute. Safe to press twice.
      </p>
      {msg ? <div className={state === 'error' ? 'alert' : 'status'}>{msg}</div> : null}
      {state !== 'done' ? (
        <button className="btn" type="button" onClick={run} disabled={state === 'busy'}>
          {state === 'busy' ? 'Importing… keep this page open' : 'Import old recipes'}
        </button>
      ) : null}
    </div>
  )
}
