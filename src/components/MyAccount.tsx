'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportButton } from './ImportButton'

export type MyRecipe = { id: number; slug: string; title: string; chapter: string; credit: string }

type Props = {
  id: number
  name: string
  email: string
  hideName: boolean
  isAdmin: boolean
  showImport: boolean
  recipes: MyRecipe[]
}

type Dialog = { kind: 'delete'; recipe: MyRecipe } | { kind: 'name' } | { kind: 'leave' } | null

async function errorText(res: Response, fallback: string) {
  try {
    const j = await res.json()
    return j?.errors?.[0]?.data?.errors?.[0]?.message || j?.errors?.[0]?.message || j?.error || fallback
  } catch {
    return fallback
  }
}

/** "Your account" from the design's "My account" boards. */
export function MyAccount(p: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'recipes' | 'profile'>('recipes')
  const [recipes, setRecipes] = useState(p.recipes)
  const [hideName, setHideName] = useState(p.hideName)
  const [name, setName] = useState(p.name)
  const [nameChoice, setNameChoice] = useState(p.hideName)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [leaveMode, setLeaveMode] = useState<'keep' | 'delete'>('keep')
  const [busy, setBusy] = useState(false)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const dlgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dialog) return
    dlgRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDialog(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  const shownName = name.trim() || p.name
  const credit = (r: MyRecipe) => (hideName && r.credit === p.name ? 'Family recipe' : r.credit === p.name ? shownName : r.credit)
  const ownCount = recipes.length

  const say = (msg: string) => {
    setError('')
    setBanner(msg)
  }
  const fail = (msg: string) => {
    setBanner('')
    setError(msg)
  }

  async function patchMe(data: Record<string, unknown>) {
    const res = await fetch(`/api/users/${p.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await errorText(res, 'Couldn’t save.'))
  }

  async function confirm() {
    if (!dialog) return
    setBusy(true)
    try {
      if (dialog.kind === 'delete') {
        const res = await fetch(`/api/recipes/${dialog.recipe.id}`, { method: 'DELETE', credentials: 'include' })
        if (!res.ok) throw new Error(await errorText(res, 'Couldn’t delete it.'))
        setRecipes((rs) => rs.filter((r) => r.id !== dialog.recipe.id))
        say(`“${dialog.recipe.title}” was deleted.`)
      } else if (dialog.kind === 'name') {
        await patchMe({ hideName: true })
        setHideName(true)
        setNameChoice(true)
        say(`Your name is off all ${ownCount} recipes. They now show “Family recipe”.`)
      } else if (dialog.kind === 'leave') {
        const res = await fetch('/api/users/leave', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipes: leaveMode }),
        })
        if (!res.ok) throw new Error(await errorText(res, 'Couldn’t delete your account.'))
        router.push('/')
        router.refresh()
        return
      }
      setDialog(null)
      router.refresh()
    } catch (err) {
      setDialog(null)
      fail(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function showName() {
    try {
      await patchMe({ hideName: false })
      setHideName(false)
      setNameChoice(false)
      say('Your name is back on your recipes.')
      router.refresh()
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Couldn’t save.')
    }
  }

  async function saveProfile() {
    if (!name.trim()) return fail('Your name can’t be empty.')
    setBusy(true)
    try {
      await patchMe({ name: name.trim(), hideName: nameChoice })
      setHideName(nameChoice)
      say('Profile saved.')
      router.refresh()
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Couldn’t save.')
    } finally {
      setBusy(false)
    }
  }

  async function savePassword() {
    if (next.length < 8) return fail('Use at least 8 characters for the new password.')
    setBusy(true)
    try {
      const check = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: p.email, password: cur }),
      })
      if (!check.ok) throw new Error('Your current password isn’t right.')
      await patchMe({ password: next })
      // Sign in again with the new password so this device stays signed in.
      await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: p.email, password: next }),
      })
      setCur('')
      setNext('')
      say('Password changed.')
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Couldn’t change the password.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
    router.refresh()
  }

  const dlg =
    dialog?.kind === 'delete'
      ? {
          t: `Delete “${dialog.recipe.title}”?`,
          b: 'It disappears from the book for everyone. This can’t be undone.',
          c: 'Delete recipe',
          x: 'Keep it',
        }
      : dialog?.kind === 'name'
        ? {
            t: 'Remove your name from your recipes?',
            b: `Your ${ownCount} recipes stay in the book. They’ll show “Family recipe” instead of “${shownName}”. You can put your name back anytime.`,
            c: 'Remove my name',
            x: 'Cancel',
          }
        : dialog?.kind === 'leave'
          ? {
              t: 'Delete your account?',
              b: `You won’t be able to sign in. Bri can add you again later. What should happen to your ${ownCount} recipes?`,
              c: 'Delete my account',
              x: 'Cancel',
            }
          : null

  return (
    <main className="wrap">
      <div className="sheet sheet--pad" style={{ minHeight: 640 }}>
        <div className="acct-head">
          <h1>Your account</h1>
          <button type="button" className="btn btn--link" onClick={signOut} style={{ letterSpacing: '0.2em' }}>
            Sign out
          </button>
        </div>

        <div className="acct-tabs" role="tablist" aria-label="Account sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recipes'}
            onClick={() => {
              setTab('recipes')
              setBanner('')
            }}
          >
            My recipes ({recipes.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            onClick={() => {
              setTab('profile')
              setBanner('')
            }}
          >
            Profile
          </button>
        </div>

        {banner ? (
          <div role="status" className="status" style={{ marginTop: 22 }}>
            {banner}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="alert" style={{ marginTop: 22 }}>
            {error}
          </div>
        ) : null}

        {tab === 'recipes' ? (
          <>
            {p.showImport ? <ImportButton /> : null}
            <div className="sec-head" style={{ margin: '26px 0 6px' }}>
              <p className="muted-i" style={{ margin: 0 }}>
                {recipes.length} published. Credited to {hideName ? 'Family recipe' : shownName}.
              </p>
              {recipes.length ? (
                hideName ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={showName}>
                    Put my name back
                  </button>
                ) : (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDialog({ kind: 'name' })}>
                    Remove my name from all
                  </button>
                )
              ) : null}
            </div>
            {recipes.length ? (
              <>
                <div className="table-head acct-grid">
                  <span>Recipe</span>
                  <span className="col-ch">Chapter</span>
                  <span className="col-credit">Credited to</span>
                  <span style={{ textAlign: 'right' }}>Actions</span>
                </div>
                {recipes.map((r) => (
                  <div key={r.id} className="table-row acct-grid">
                    <div style={{ minWidth: 0 }}>
                      <span className="t">{r.title}</span>
                      <span className="only-phone s">
                        {r.chapter} · {credit(r)}
                      </span>
                    </div>
                    <span className="col-ch" style={{ fontSize: 16, color: 'var(--ink-2)' }}>
                      {r.chapter}
                    </span>
                    <span className="col-credit s">{credit(r)}</span>
                    <div className="row-actions">
                      <Link className="quiet" href={`/recipes/${r.slug}`}>
                        View
                      </Link>
                      <Link className="quiet" href={`/add?edit=${r.id}`}>
                        Edit
                      </Link>
                      <button type="button" aria-label={`Delete ${r.title}`} onClick={() => setDialog({ kind: 'delete', recipe: r })}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="empty-box" style={{ marginTop: 22 }}>
                <p style={{ margin: 0 }}>
                  You haven’t added any recipes. <Link href="/add">Add your first one</Link>.
                </p>
              </div>
            )}
          </>
        ) : null}

        {tab === 'profile' ? (
          <div className="prof">
            <div>
              <h2>Profile</h2>
              <div className="field">
                <label htmlFor="ma-name" className="lbl">
                  Your name
                </label>
                <input id="ma-name" className="fld" value={name} onChange={(e) => setName(e.target.value)} />
                <span className="hint">Shown on recipes you add, unless you hide it below.</span>
              </div>
              <div className="field">
                <label htmlFor="ma-email" className="lbl">
                  Email
                </label>
                <input id="ma-email" className="fld" type="email" value={p.email} readOnly />
                <span className="hint">To change your email, ask Bri.</span>
              </div>
              <fieldset>
                <legend className="lbl">On your recipes, show</legend>
                {(
                  [
                    [false, 'My name', `Recipes say “by ${shownName}”`],
                    [true, 'Family recipe', 'Your name is hidden on all your recipes'],
                  ] as const
                ).map(([v, label, note]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={nameChoice === v}
                    className="radio"
                    onClick={() => setNameChoice(v)}
                  >
                    <span className="dot" />
                    <span>
                      {label}
                      <span className="note">{note}</span>
                    </span>
                  </button>
                ))}
              </fieldset>
              <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={saveProfile} disabled={busy}>
                Save changes
              </button>
            </div>
            <div>
              <h2>Password</h2>
              <div className="field">
                <label htmlFor="ma-cur" className="lbl">
                  Current password
                </label>
                <input
                  id="ma-cur"
                  className="fld"
                  type="password"
                  autoComplete="current-password"
                  value={cur}
                  onChange={(e) => setCur(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ma-new" className="lbl">
                  New password
                </label>
                <input
                  id="ma-new"
                  className="fld"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <span className="hint">At least 8 characters.</span>
              </div>
              <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={savePassword} disabled={busy}>
                Change password
              </button>
              {p.isAdmin ? (
                <div className="danger-zone">
                  <h3>Admin</h3>
                  <p>Add family members, reset passwords, and manage chapters and tags.</p>
                  <a className="btn btn--ghost btn--sm" href="/admin">
                    Open the admin panel
                  </a>
                </div>
              ) : null}
              <div className="danger-zone">
                <h3>Leave the cookbook</h3>
                <p>Deletes your account. You choose whether your recipes stay in the book.</p>
                <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--rust)' }} onClick={() => setDialog({ kind: 'leave' })}>
                  Delete my account
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {dlg ? (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setDialog(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" className="dlg" ref={dlgRef}>
            <h2 id="dlg-title">{dlg.t}</h2>
            <p>{dlg.b}</p>
            {dialog?.kind === 'leave' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(
                  [
                    ['keep', 'Keep my recipes in the book, credited to “Family recipe”'],
                    ['delete', 'Delete my recipes too'],
                  ] as const
                ).map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={leaveMode === v} className="radio" onClick={() => setLeaveMode(v)}>
                    <span className="dot" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="dlg-actions">
              <button type="button" className={dialog?.kind === 'name' ? 'btn' : 'btn btn--danger'} onClick={confirm} disabled={busy}>
                {busy ? 'One moment…' : dlg.c}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setDialog(null)}>
                {dlg.x}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
