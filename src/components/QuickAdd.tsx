'use client'
/**
 * Quick Add — the family's way to add a recipe, built for phones first.
 * Three ways in: paste a link, paste text, or type. Save publishes right away.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseIngredientsText, splitLines } from '@/lib/ingredients'
import { fromPastedText, type RecipeDraft } from '@/lib/recipeImport'

export type QuickAddInitial = {
  id?: number
  slug?: string
  title: string
  chapter?: number
  ingredientsText: string
  stepsText: string
  equipmentText?: string
  intro?: string
  notes?: string
  servings?: number
  prepMinutes?: number
  cookMinutes?: number
  sourceUrl?: string
  tags?: number[]
  photoId?: number
  photoUrl?: string
}

type Props = {
  chapters: { id: number; label: string }[]
  tags: { id: number; name: string }[]
  initial?: QuickAddInitial
  defaultChapter?: number
}

type Mode = 'link' | 'paste' | 'type'
const DRAFT_KEY = 'delbuico:quick-add-draft'

const empty: QuickAddInitial = { title: '', ingredientsText: '', stepsText: '' }

const toNum = (v: string) => {
  const n = Number(v)
  return v.trim() === '' || !isFinite(n) ? undefined : n
}

/** Shrinks a phone photo before upload: max 1600px, JPEG. Keeps uploads well under hosting limits. */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1600
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    return blob || file
  } catch {
    return file // e.g. HEIC on some browsers; let the server deal with it
  }
}

async function apiError(res: Response, fallback: string) {
  try {
    const j = await res.json()
    const first = j?.errors?.[0]
    const fieldMsgs = first?.data?.errors?.map((e: { message: string }) => e.message).join(' ')
    return fieldMsgs || first?.message || j?.error || fallback
  } catch {
    return fallback
  }
}

export function QuickAdd({ chapters, tags, initial, defaultChapter }: Props) {
  const router = useRouter()
  const editing = Boolean(initial?.id)
  const [mode, setMode] = useState<Mode>(editing ? 'type' : 'link')
  const [form, setForm] = useState<QuickAddInitial>(
    initial || { ...empty, chapter: defaultChapter },
  )
  const [link, setLink] = useState('')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState<'' | 'import' | 'save' | 'delete'>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(initial?.photoUrl)
  const formRef = useRef<HTMLFormElement>(null)
  const moreRef = useRef<HTMLDetailsElement>(null)

  // Restore an unsaved draft (new recipes only) — handy if the phone locks mid-way.
  useEffect(() => {
    if (editing) return
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const d = JSON.parse(saved)
        if (d && (d.title || d.ingredientsText)) {
          setForm((f) => ({ ...f, ...d }))
          setMode('type')
          setNotice('We kept the recipe you were working on. Carry on, or clear the form to start fresh.')
        }
      }
    } catch {
      /* storage unavailable */
    }
  }, [editing])

  useEffect(() => {
    if (editing) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
      } catch {
        /* ignore */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form, editing])

  const set = <K extends keyof QuickAddInitial>(key: K, value: QuickAddInitial[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const ingredientCount = useMemo(() => parseIngredientsText(form.ingredientsText).length, [form.ingredientsText])
  const stepCount = useMemo(() => splitLines(form.stepsText).length, [form.stepsText])

  function applyDraft(d: RecipeDraft, how: string) {
    setForm((f) => ({
      ...f,
      title: d.title || f.title,
      ingredientsText: d.ingredientsText || f.ingredientsText,
      stepsText: d.stepsText || f.stepsText,
      servings: d.servings ?? f.servings,
      prepMinutes: d.prepMinutes ?? f.prepMinutes,
      cookMinutes: d.cookMinutes ?? f.cookMinutes,
      intro: d.intro ?? f.intro,
      sourceUrl: d.sourceUrl ?? f.sourceUrl,
    }))
    setMode('type')
    setNotice(`${how} Check it over, pick a chapter, then save.`)
    if (d.servings || d.prepMinutes || d.cookMinutes || d.intro) moreRef.current?.setAttribute('open', '')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function importLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy('import')
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.draft) {
        applyDraft(j.draft, 'Filled in from the link.')
      } else {
        setError(j.error || 'Couldn’t read that link.')
        if (j.draft?.title) set('title', j.draft.title)
        if (j.draft?.sourceUrl) set('sourceUrl', j.draft.sourceUrl)
        setMode('paste')
      }
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.')
    } finally {
      setBusy('')
    }
  }

  function importText(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const d = fromPastedText(pasted)
    if (!d.ingredientsText && !d.stepsText) {
      setError('Couldn’t find ingredients or steps in that text. You can type them in below instead.')
      setMode('type')
      return
    }
    applyDraft(d, 'Split into title, ingredients and steps.')
  }

  async function uploadPhoto(): Promise<number | undefined> {
    if (!photoFile) return form.photoId
    const blob = await shrinkImage(photoFile)
    const fd = new FormData()
    const name = (photoFile.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    fd.append('file', blob, blob === photoFile ? photoFile.name : name)
    fd.append('_payload', JSON.stringify({ alt: form.title }))
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
    if (!res.ok) throw new Error(await apiError(res, 'The photo didn’t upload. Try a different one, or save without it.'))
    const j = await res.json()
    return j.doc?.id
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) return setError('Give the recipe a title.')
    if (!form.chapter) return setError('Pick a chapter.')
    if (!ingredientCount) return setError('Add at least one ingredient.')
    setBusy('save')
    try {
      const photo = await uploadPhoto()
      const body = {
        title: form.title,
        chapter: form.chapter,
        ingredientsText: form.ingredientsText,
        stepsText: form.stepsText.trim() || '(no steps written yet)',
        equipmentText: form.equipmentText || '',
        intro: form.intro || '',
        notes: form.notes || '',
        servings: form.servings ?? null,
        prepMinutes: form.prepMinutes ?? null,
        cookMinutes: form.cookMinutes ?? null,
        sourceUrl: form.sourceUrl || '',
        tags: form.tags || [],
        photo: photo ?? null,
      }
      const res = await fetch(editing ? `/api/recipes/${form.id}` : '/api/recipes', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401 || res.status === 403) {
        throw new Error('You’ve been logged out. Log in again in another tab, then press Save — your text is kept.')
      }
      if (!res.ok) throw new Error(await apiError(res, 'Couldn’t save. Try again.'))
      const j = await res.json()
      try {
        if (!editing) localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      router.push(`/recipes/${j.doc?.slug || form.slug}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save. Try again.')
      setBusy('')
    }
  }

  async function remove() {
    if (!form.id) return
    if (!window.confirm(`Delete “${form.title}” from the cookbook? This can’t be undone.`)) return
    setBusy('delete')
    const res = await fetch(`/api/recipes/${form.id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      setError(await apiError(res, 'Couldn’t delete it.'))
      setBusy('')
      return
    }
    router.push('/account')
    router.refresh()
  }

  function clearForm() {
    setForm({ ...empty, chapter: defaultChapter })
    setPhotoFile(null)
    setPhotoPreview(undefined)
    setNotice('')
    setError('')
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }

  const toggleTag = (id: number) =>
    set('tags', (form.tags || []).includes(id) ? (form.tags || []).filter((t) => t !== id) : [...(form.tags || []), id])

  return (
    <>
      {!editing ? (
        <div className="tabs" role="tablist" aria-label="How do you want to add it?">
          {(
            [
              ['link', 'Paste a link'],
              ['paste', 'Paste text'],
              ['type', 'Type it'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      ) : null}
      {notice && !error ? <div className="notice notice--ok">{notice}</div> : null}

      {mode === 'link' && !editing ? (
        <form className="import-box" onSubmit={importLink}>
          <p>Found it online? Paste the web address and we’ll fill in the form for you.</p>
          <label className="field" style={{ marginBottom: 14 }}>
            <span>Recipe link</span>
            <input
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              required
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={busy === 'import'} style={{ width: '100%' }}>
            {busy === 'import' ? 'Reading the page…' : 'Fill in from link'}
          </button>
        </form>
      ) : null}

      {mode === 'paste' && !editing ? (
        <form className="import-box" onSubmit={importText}>
          <p>Copy the whole recipe (from a text, an email, a website) and paste it here. We’ll split it up.</p>
          <label className="field" style={{ marginBottom: 14 }}>
            <span>Recipe text</span>
            <textarea
              className="textarea"
              style={{ minHeight: 220 }}
              placeholder={'Grandma’s Rice\n\nIngredients\n2 cups rice\n…\n\nSteps\nRinse the rice…'}
              required
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          </label>
          <button className="btn" type="submit" style={{ width: '100%' }}>
            Fill in the form
          </button>
        </form>
      ) : null}

      <form ref={formRef} onSubmit={save} noValidate>
        <label className="field">
          <span>
            Title <span className="req">*</span>
          </span>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Soupe Joumou"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>
            Chapter <span className="req">*</span>
          </span>
          <select
            className="select"
            value={form.chapter ?? ''}
            onChange={(e) => set('chapter', toNum(e.target.value))}
          >
            <option value="">Choose a chapter…</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>
            Ingredients <span className="req">*</span>
          </span>
          <span className="hint">One per line. Put a swap after a | — e.g. “1 cup sugar | or honey”.</span>
          <textarea
            className="textarea"
            style={{ minHeight: 200 }}
            value={form.ingredientsText}
            onChange={(e) => set('ingredientsText', e.target.value)}
            placeholder={'2 cups rice\n1 1/2 tsp salt\n3 cloves garlic, minced'}
          />
          <span className="preview-count">
            {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}
          </span>
        </label>

        <label className="field">
          <span>Steps</span>
          <span className="hint">One step per line.</span>
          <textarea
            className="textarea"
            style={{ minHeight: 200 }}
            value={form.stepsText}
            onChange={(e) => set('stepsText', e.target.value)}
            placeholder={'Rinse the rice until the water runs clear.\nBring the water to a boil…'}
          />
          <span className="preview-count">
            {stepCount} step{stepCount === 1 ? '' : 's'}
          </span>
        </label>

        <details className="more" ref={moreRef} open={editing && Boolean(form.servings || form.intro || form.notes)}>
          <summary>More details (optional)</summary>
          <div className="more__body">
            <div className="row">
              <label className="field">
                <span>Serves</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.servings ?? ''}
                  onChange={(e) => set('servings', toNum(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Prep (min)</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.prepMinutes ?? ''}
                  onChange={(e) => set('prepMinutes', toNum(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Cook (min)</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.cookMinutes ?? ''}
                  onChange={(e) => set('cookMinutes', toNum(e.target.value))}
                />
              </label>
            </div>

            <div className="field">
              <span>Photo</span>
              <div className="photo-pick">
                {photoPreview ? <img src={photoPreview} alt="" /> : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setPhotoFile(f)
                    setPhotoPreview(f ? URL.createObjectURL(f) : initial?.photoUrl)
                  }}
                />
                {photoPreview ? (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(undefined)
                      set('photoId', undefined)
                    }}
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>

            <label className="field">
              <span>Intro note</span>
              <span className="hint">A line about the dish — where it’s from, who makes it best.</span>
              <textarea
                className="textarea"
                style={{ minHeight: 90 }}
                value={form.intro || ''}
                onChange={(e) => set('intro', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Closing notes</span>
              <span className="hint">Tips, swaps, conversions. Shown “in the margin”.</span>
              <textarea
                className="textarea"
                style={{ minHeight: 90 }}
                value={form.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Equipment</span>
              <span className="hint">One item per line.</span>
              <textarea
                className="textarea"
                style={{ minHeight: 80 }}
                value={form.equipmentText || ''}
                onChange={(e) => set('equipmentText', e.target.value)}
              />
            </label>

            {tags.length ? (
              <div className="field">
                <span>Tags</span>
                <div className="chips">
                  {tags.map((t) => (
                    <label key={t.id} className="chip">
                      <input type="checkbox" checked={(form.tags || []).includes(t.id)} onChange={() => toggleTag(t.id)} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="field">
              <span>Original link</span>
              <input
                className="input"
                type="url"
                inputMode="url"
                value={form.sourceUrl || ''}
                onChange={(e) => set('sourceUrl', e.target.value)}
              />
            </label>
          </div>
        </details>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy !== ''}>
            {busy === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Save to the cookbook'}
          </button>
          {editing ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => router.back()} disabled={busy !== ''}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger btn--small" onClick={remove} disabled={busy !== ''}>
                {busy === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : form.title || form.ingredientsText ? (
            <button type="button" className="linkish" onClick={clearForm}>
              Clear form
            </button>
          ) : null}
        </div>
      </form>
    </>
  )
}
