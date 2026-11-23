'use client'
/**
 * Quick Add — from the design's "Quick Add" boards.
 * Start screen (paste a link / paste text / type it), an unfinished-draft card,
 * the form with a live preview, and a "Published" screen. Save publishes.
 */
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMinutes, parseIngredientsText, quantityLabel, splitLines } from '@/lib/ingredients'
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
  cookName?: string
  tags?: number[]
  photoId?: number
  photoUrl?: string
}

type Props = {
  chapters: { id: number; title: string }[]
  tags: { id: number; name: string }[]
  cooks: string[]
  me: string
  initial?: QuickAddInitial
  defaultChapter?: number
  defaultTitle?: string
}

type Mode = 'link' | 'paste' | 'type'
type Draft = {
  title: string
  chapter: string
  ing: string
  steps: string
  serves: string
  prep: string
  cookt: string
  cook: string
  cookNew: string
  tags: number[]
  intro: string
  outro: string
  equipment: string
  sourceUrl: string
}
type Saved = Draft & { savedAt: number }

const DRAFT_KEY = 'delbuico:quick-add-draft:v2'
const EMPTY: Draft = {
  title: '',
  chapter: '',
  ing: '',
  steps: '',
  serves: '',
  prep: '',
  cookt: '',
  cook: '',
  cookNew: '',
  tags: [],
  intro: '',
  outro: '',
  equipment: '',
  sourceUrl: '',
}

const hasContent = (d: Draft) => Boolean(d.title.trim() || d.ing.trim() || d.steps.trim())

function ago(ts: number) {
  const min = Math.round((Date.now() - ts) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/** Shrinks a phone photo before upload: max 1600px JPEG. */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))) || file
  } catch {
    return file
  }
}

async function apiError(res: Response, fallback: string) {
  try {
    const j = await res.json()
    const first = j?.errors?.[0]
    return first?.data?.errors?.map((e: { message: string }) => e.message).join(' ') || first?.message || j?.error || fallback
  } catch {
    return fallback
  }
}

const Check = ({ color = '#4E6B3F', size = 20 }: { color?: string; size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" style={{ flex: 'none', marginTop: 2 }}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export function QuickAdd({ chapters, tags, cooks, me, initial, defaultChapter, defaultTitle }: Props) {
  const router = useRouter()
  const editing = Boolean(initial?.id)
  const fromInitial = (i: QuickAddInitial): Draft => {
    const cookName = i.cookName || ''
    const known = !cookName || cooks.includes(cookName)
    return {
      title: i.title,
      chapter: i.chapter ? String(i.chapter) : '',
      ing: i.ingredientsText || '',
      steps: (i.stepsText || '').replace(/^\((no steps written yet|none listed)\)$/i, ''),
      serves: i.servings ? String(i.servings) : '',
      prep: i.prepMinutes ? String(i.prepMinutes) : '',
      cookt: i.cookMinutes ? String(i.cookMinutes) : '',
      cook: known ? cookName : 'new',
      cookNew: known ? '' : cookName,
      tags: i.tags || [],
      intro: i.intro || '',
      outro: i.notes || '',
      equipment: i.equipmentText || '',
      sourceUrl: i.sourceUrl || '',
    }
  }

  const [screen, setScreen] = useState<'start' | 'form' | 'published'>(editing || defaultTitle ? 'form' : 'start')
  const [mode, setMode] = useState<Mode>('type')
  const [d, setD] = useState<Draft>(
    initial ? fromInitial(initial) : { ...EMPTY, chapter: defaultChapter ? String(defaultChapter) : '', title: defaultTitle || '' },
  )
  const [savedDraft, setSavedDraft] = useState<Saved | null>(null)
  const [dirty, setDirty] = useState(false)

  const [url, setUrl] = useState('')
  const [urlBad, setUrlBad] = useState(false)
  const [link, setLink] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [pasteText, setPasteText] = useState('')
  const [pasteDone, setPasteDone] = useState(false)
  const [pasteEmpty, setPasteEmpty] = useState(false)
  const [notice, setNotice] = useState('')

  const [more, setMore] = useState(
    editing &&
      Boolean(
        initial?.servings || initial?.intro || initial?.notes || initial?.prepMinutes || initial?.photoUrl || initial?.cookName,
      ),
  )
  const [titleErr, setTitleErr] = useState(false)
  const [ingErr, setIngErr] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [published, setPublished] = useState<{ slug: string; title: string; chapter: string; ing: number; steps: number } | null>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(initial?.photoUrl)
  const [photoId, setPhotoId] = useState<number | undefined>(initial?.photoId)
  const fileRef = useRef<HTMLInputElement>(null)
  const formTop = useRef<HTMLDivElement>(null)

  // Unfinished draft saved on this device (new recipes only).
  useEffect(() => {
    if (editing) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const s = JSON.parse(raw) as Saved
        if (s && hasContent(s)) setSavedDraft(s)
      }
    } catch {
      /* storage unavailable */
    }
  }, [editing])

  useEffect(() => {
    if (editing || !dirty || screen !== 'form') return
    const t = setTimeout(() => {
      try {
        if (hasContent(d)) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }))
      } catch {
        /* ignore */
      }
    }, 500)
    return () => clearTimeout(t)
  }, [d, dirty, editing, screen])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    setDirty(true)
  }

  const parsed = useMemo(() => parseIngredientsText(d.ing), [d.ing])
  const stepLines = useMemo(() => splitLines(d.steps), [d.steps])
  const noAmount = parsed.filter((p) => p.qty == null).length
  const chapterName = chapters.find((c) => String(c.id) === d.chapter)?.title || 'Uncategorized'
  const showFields = mode === 'type' || (mode === 'link' && link === 'done') || (mode === 'paste' && pasteDone)

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
    setSavedDraft(null)
  }

  function applyDraft(r: RecipeDraft, message: string) {
    setD((x) => ({
      ...x,
      title: r.title || x.title,
      ing: r.ingredientsText || x.ing,
      steps: r.stepsText || x.steps,
      serves: r.servings ? String(r.servings) : x.serves,
      prep: r.prepMinutes ? String(r.prepMinutes) : x.prep,
      cookt: r.cookMinutes ? String(r.cookMinutes) : x.cookt,
      intro: r.intro ?? x.intro,
      sourceUrl: r.sourceUrl ?? x.sourceUrl,
    }))
    setDirty(true)
    setNotice(message)
  }

  async function fetchLink() {
    const u = url.trim()
    if (!/^https?:\/\/\S+\.\S+/.test(u)) {
      setUrlBad(true)
      return
    }
    setUrlBad(false)
    setLink('loading')
    setNotice('')
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.draft) {
        const n = parseIngredientsText(j.draft.ingredientsText).length
        const s = splitLines(j.draft.stepsText).length
        const host = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
        applyDraft(j.draft, `Found it. We filled in ${n} ingredients and ${s} steps from ${host}. Check them, then save.`)
        setLink('done')
      } else {
        if (j.draft?.sourceUrl) set('sourceUrl', j.draft.sourceUrl)
        if (j.draft?.title && !d.title) set('title', j.draft.title)
        setLink('error')
      }
    } catch {
      setLink('error')
    }
  }

  function splitPaste() {
    if (!pasteText.trim()) {
      setPasteEmpty(true)
      return
    }
    applyDraft(fromPastedText(pasteText), 'Filled in from your text. Check that the ingredients and steps landed in the right boxes.')
    setPasteDone(true)
  }

  function pickMode(m: Mode) {
    setMode(m)
    setNotice('')
    setScreen('form')
  }

  async function uploadPhoto(): Promise<number | null> {
    if (!photoFile) return photoId ?? null
    const blob = await shrinkImage(photoFile)
    const fd = new FormData()
    const name = (photoFile.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    fd.append('file', blob, blob === photoFile ? photoFile.name : name)
    fd.append('_payload', JSON.stringify({ alt: d.title }))
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
    if (!res.ok) throw new Error(await apiError(res, 'The photo didn’t upload. Try a different one, or save without it.'))
    const j = await res.json()
    return j.doc?.id ?? null
  }

  async function save() {
    setSaveErr('')
    const te = !d.title.trim()
    const ie = parsed.length === 0
    if (!showFields) setMode('type')
    setTitleErr(te)
    setIngErr(ie)
    if (te || ie) {
      formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setBusy(true)
    try {
      const photo = await uploadPhoto()
      const cookName = d.cook === 'new' ? d.cookNew.trim() : d.cook
      const body = {
        title: d.title,
        chapter: d.chapter ? Number(d.chapter) : null,
        ingredientsText: d.ing,
        stepsText: d.steps,
        equipmentText: d.equipment,
        intro: d.intro,
        notes: d.outro,
        servings: d.serves ? Number(d.serves) || null : null,
        prepMinutes: d.prep ? Number(d.prep) || null : null,
        cookMinutes: d.cookt ? Number(d.cookt) || null : null,
        sourceUrl: d.sourceUrl,
        cookName,
        tags: d.tags,
        photo,
      }
      const res = await fetch(editing ? `/api/recipes/${initial!.id}` : '/api/recipes', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401 || res.status === 403) {
        throw new Error('You’ve been signed out. Sign in again in another tab, then press Save. Your text is kept.')
      }
      if (!res.ok) throw new Error(await apiError(res, 'Couldn’t save. Try again.'))
      const j = await res.json()
      const slug = j.doc?.slug || initial?.slug || ''
      if (editing) {
        router.push(`/recipes/${slug}`)
        router.refresh()
        return
      }
      clearDraft()
      setDirty(false)
      setPublished({ slug, title: d.title, chapter: chapterName, ing: parsed.length, steps: stepLines.length })
      setScreen('published')
      window.scrollTo({ top: 0 })
      router.refresh()
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Couldn’t save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function addAnother() {
    setD({ ...EMPTY })
    setUrl('')
    setLink('idle')
    setPasteText('')
    setPasteDone(false)
    setNotice('')
    setPhotoFile(null)
    setPhotoPreview(undefined)
    setPhotoId(undefined)
    setMore(false)
    setDirty(false)
    setScreen('start')
  }

  const toggleTag = (id: number) => set('tags', d.tags.includes(id) ? d.tags.filter((t) => t !== id) : [...d.tags, id])
  const draftStatus = !editing && screen === 'form' && dirty && hasContent(d) ? 'Draft saved' : ''
  const firstMe = me.split(' ')[0]

  return (
    <>
      <header className="qa-bar">
        <Link href={editing && initial?.slug ? `/recipes/${initial.slug}` : '/'} className="cancel">
          ← Cancel
        </Link>
        <Link href="/" className="brand">
          The DelBuiCo <i>Cookbook</i>
        </Link>
        <span className="qa-status hide-phone">{draftStatus}</span>
      </header>

      <div className="qa-main">
        <div className="qa-card">
          {screen === 'published' && published ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', padding: '12px 0' }}>
              <span className="done-mark">
                <Check size={26} />
              </span>
              <span className="lbl" style={{ color: 'var(--green)' }}>
                Published
              </span>
              <h1 className="t-qa" style={{ lineHeight: 1.05 }}>
                {published.title}
              </h1>
              <p style={{ margin: 0, color: 'var(--ink-2)', maxWidth: '40ch' }}>
                It’s in {published.chapter} now. Everyone in the family can see it.
              </p>
              <div className="done-facts">
                <span>
                  {published.ing} {published.ing === 1 ? 'ingredient' : 'ingredients'}
                </span>
                <span>
                  {published.steps} {published.steps === 1 ? 'step' : 'steps'}
                </span>
                <span>Added by {firstMe}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                <Link className="btn" href={`/recipes/${published.slug}`}>
                  View recipe
                </Link>
                <button type="button" className="btn btn--ghost" onClick={addAnother}>
                  Add another
                </button>
                <Link className="btn btn--link" href="/" style={{ padding: '0 12px' }}>
                  Back to the book
                </Link>
              </div>
            </div>
          ) : null}

          {screen === 'start' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 className="t-qa">Add a recipe</h1>
                <p className="muted-i" style={{ margin: '8px 0 0' }}>
                  How do you want to start? You can change anything before it’s saved.
                </p>
              </div>
              {savedDraft ? (
                <div className="draft-card">
                  <div style={{ minWidth: 0 }}>
                    <div className="lbl" style={{ color: 'var(--rose)' }}>
                      Unfinished recipe
                    </div>
                    <div className="t">{savedDraft.title || 'Untitled recipe'}</div>
                    <div className="hint">
                      Saved on this device {ago(savedDraft.savedAt)} · {parseIngredientsText(savedDraft.ing).length} ingredients
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => {
                        const { savedAt: _ignored, ...rest } = savedDraft
                        setD({ ...EMPTY, ...rest })
                        setDirty(true)
                        setMode('type')
                        setScreen('form')
                        if (rest.serves || rest.prep || rest.intro || rest.outro) setMore(true)
                      }}
                    >
                      Continue
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={clearDraft}>
                      Discard
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="pick">
                {(
                  [
                    ['link', '1', 'Paste a link', 'From a recipe website. We fill in the title, ingredients and steps.'],
                    ['paste', '2', 'Paste text', 'From a text, an email or your notes. We split it into the right boxes.'],
                    ['type', '3', 'Type it', 'Write it out. One box for ingredients, one for steps.'],
                  ] as const
                ).map(([m, n, label, desc]) => (
                  <button key={m} type="button" onClick={() => pickMode(m)}>
                    <span className="num">{n}</span>
                    <span className="t">{label}</span>
                    <span className="d">{desc}</span>
                  </button>
                ))}
              </div>
              <p className="hint" style={{ margin: 0 }}>
                Only a title and one ingredient are required.
              </p>
            </div>
          ) : null}

          {screen === 'form' ? (
            <div className="qa-stack" ref={formTop}>
              <div>
                <h1 className="t-qa">{editing ? 'Edit recipe' : 'Add a recipe'}</h1>
                <p className="muted-i" style={{ margin: '8px 0 0' }}>
                  {editing ? 'Changes show for everyone as soon as you save.' : 'A title and one ingredient are enough. Everything else can wait.'}
                </p>
              </div>

              {!editing ? (
                <div className="tabs" role="tablist" aria-label="How to add">
                  {(
                    [
                      ['link', 'Paste a link'],
                      ['paste', 'Paste text'],
                      ['type', 'Type it'],
                    ] as const
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => {
                        setMode(m)
                        setNotice('')
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {titleErr || ingErr ? (
                <div role="alert" className="alert">
                  Add a title and at least one ingredient, then save again.
                </div>
              ) : null}

              {mode === 'link' && !editing ? (
                <>
                  <div className="field">
                    <label htmlFor="qa-url" className="lbl">
                      Recipe link
                    </label>
                    <div className="link-row">
                      <input
                        id="qa-url"
                        className="fld"
                        type="url"
                        inputMode="url"
                        placeholder="https://…"
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value)
                          setUrlBad(false)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            fetchLink()
                          }
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button type="button" className="btn" onClick={fetchLink} disabled={link === 'loading'}>
                        {link === 'loading' ? 'Reading…' : 'Fill in'}
                      </button>
                    </div>
                    <span className="hint">Copy the link from your browser’s address bar. Works on most recipe sites.</span>
                    {urlBad ? <span className="err">That doesn’t look like a web address. It should start with https://</span> : null}
                  </div>
                  {link === 'loading' ? (
                    <div aria-live="polite" className="loading-box">
                      <span className="hint">Looking for the recipe on that page…</span>
                      <span className="skel" style={{ width: '60%' }} />
                      <span className="skel" style={{ width: '90%' }} />
                      <span className="skel" style={{ width: '75%' }} />
                      <span className="skel" style={{ width: '82%' }} />
                    </div>
                  ) : null}
                  {link === 'error' ? (
                    <div role="alert" className="link-err">
                      <div className="t">Couldn’t read a recipe from that page</div>
                      <p>
                        Some sites block this, and some pages don’t have recipe data. Copy the recipe text from the page and
                        paste it instead.
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => {
                            setMode('paste')
                            setLink('idle')
                          }}
                        >
                          Paste text instead
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={fetchLink}>
                          Try again
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {mode === 'paste' && !pasteDone && !editing ? (
                <div className="field">
                  <label htmlFor="qa-paste" className="lbl">
                    Paste the whole recipe
                  </label>
                  <textarea
                    id="qa-paste"
                    className="fld"
                    rows={9}
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value)
                      setPasteEmpty(false)
                    }}
                    placeholder="Title on the first line, then the ingredients, then the steps"
                    style={{ lineHeight: 1.45 }}
                  />
                  <span className="hint">From a text, an email or notes on your phone. Headings like “Ingredients” help but aren’t needed.</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn" onClick={splitPaste}>
                      Fill in the boxes
                    </button>
                    {pasteEmpty ? (
                      <span className="err" style={{ alignSelf: 'center' }}>
                        Paste something first.
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {notice ? (
                <div role="status" className="status">
                  <Check />
                  <div>{notice}</div>
                </div>
              ) : null}

              {showFields ? (
                <div className="qa-stack">
                  <div className="field">
                    <label htmlFor="qa-title" className="lbl">
                      Title
                    </label>
                    <input
                      id="qa-title"
                      className="fld"
                      aria-invalid={titleErr || undefined}
                      value={d.title}
                      onChange={(e) => {
                        set('title', e.target.value)
                        setTitleErr(false)
                      }}
                      placeholder="Rice and beans"
                      autoComplete="off"
                    />
                    {titleErr ? <span className="err">Add a title.</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="qa-chapter" className="lbl">
                      Chapter
                    </label>
                    <select id="qa-chapter" className="fld" value={d.chapter} onChange={(e) => set('chapter', e.target.value)}>
                      <option value="">Uncategorized (sort it later)</option>
                      {chapters
                        .filter((c) => c.title.toLowerCase() !== 'uncategorized')
                        .map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.title}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="qa-ing" className="lbl">
                      Ingredients
                    </label>
                    <textarea
                      id="qa-ing"
                      className="fld"
                      rows={7}
                      aria-invalid={ingErr || undefined}
                      value={d.ing}
                      onChange={(e) => {
                        set('ing', e.target.value)
                        setIngErr(false)
                      }}
                      placeholder="One per line, like: 2 cups rice"
                    />
                    {ingErr ? <span className="err">Add at least one ingredient.</span> : null}
                    <span className="hint">
                      {parsed.length
                        ? `${parsed.length} ${parsed.length === 1 ? 'ingredient' : 'ingredients'}${
                            noAmount ? `, ${noAmount} without an amount (shown as written)` : ', amounts read'
                          }. Put a swap after a | , like “1 cup sugar | or honey”.`
                        : 'One per line. Amounts at the start of a line are read automatically.'}
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor="qa-steps" className="lbl">
                      Steps
                    </label>
                    <textarea
                      id="qa-steps"
                      className="fld"
                      rows={6}
                      value={d.steps}
                      onChange={(e) => set('steps', e.target.value)}
                      placeholder="One step per line"
                    />
                    <span className="hint">Optional. One step per line.</span>
                  </div>

                  <div className="more">
                    <button type="button" className="more-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
                      <span>
                        More details <span className="sub">· servings, times, cook, tags, notes, photo</span>
                      </span>
                      <span className="pm">{more ? '–' : '+'}</span>
                    </button>
                    {more ? (
                      <div className="more-body">
                        <div className="two">
                          <div className="field">
                            <label htmlFor="qa-serves" className="lbl">
                              Serves
                            </label>
                            <input
                              id="qa-serves"
                              className="fld"
                              inputMode="numeric"
                              value={d.serves}
                              onChange={(e) => set('serves', e.target.value.replace(/[^\d]/g, ''))}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="qa-cook" className="lbl">
                              Cook
                            </label>
                            <select id="qa-cook" className="fld" value={d.cook} onChange={(e) => set('cook', e.target.value)}>
                              <option value="">Me ({firstMe})</option>
                              {cooks
                                .filter((c) => c !== me)
                                .map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              <option value="new">Someone new…</option>
                            </select>
                            {d.cook === 'new' ? (
                              <input
                                className="fld"
                                aria-label="Cook’s name"
                                placeholder="Their name"
                                value={d.cookNew}
                                onChange={(e) => set('cookNew', e.target.value)}
                              />
                            ) : null}
                          </div>
                          <div className="field">
                            <label htmlFor="qa-prep" className="lbl">
                              Prep time (minutes)
                            </label>
                            <input
                              id="qa-prep"
                              className="fld"
                              inputMode="numeric"
                              value={d.prep}
                              onChange={(e) => set('prep', e.target.value.replace(/[^\d]/g, ''))}
                            />
                            <span className="hint">{formatMinutes(Number(d.prep)) || 'A day is 1440 minutes'}</span>
                          </div>
                          <div className="field">
                            <label htmlFor="qa-cookt" className="lbl">
                              Cook time (minutes)
                            </label>
                            <input
                              id="qa-cookt"
                              className="fld"
                              inputMode="numeric"
                              value={d.cookt}
                              onChange={(e) => set('cookt', e.target.value.replace(/[^\d]/g, ''))}
                            />
                            <span className="hint">{formatMinutes(Number(d.cookt)) || ' '}</span>
                          </div>
                        </div>
                        {tags.length ? (
                          <div className="field" style={{ gap: 8 }}>
                            <span className="lbl">Tags</span>
                            <div className="try-row">
                              {tags.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="toggle"
                                  aria-pressed={d.tags.includes(t.id)}
                                  onClick={() => toggleTag(t.id)}
                                  style={{ letterSpacing: '0.12em' }}
                                >
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="field">
                          <label htmlFor="qa-intro" className="lbl">
                            Intro note
                          </label>
                          <textarea
                            id="qa-intro"
                            className="fld"
                            rows={2}
                            value={d.intro}
                            onChange={(e) => set('intro', e.target.value)}
                            placeholder="Shows above the ingredients"
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="qa-outro" className="lbl">
                            Closing note
                          </label>
                          <textarea
                            id="qa-outro"
                            className="fld"
                            rows={2}
                            value={d.outro}
                            onChange={(e) => set('outro', e.target.value)}
                            placeholder="Tips, storage, what to serve it with"
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="qa-equip" className="lbl">
                            Equipment
                          </label>
                          <textarea
                            id="qa-equip"
                            className="fld"
                            rows={2}
                            value={d.equipment}
                            onChange={(e) => set('equipment', e.target.value)}
                            placeholder="One per line, like: Dutch oven"
                          />
                        </div>
                        <div className="field" style={{ gap: 8 }}>
                          <span className="lbl">Photo</span>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null
                              if (!f) return
                              setPhotoFile(f)
                              setPhotoPreview(URL.createObjectURL(f))
                              setDirty(true)
                            }}
                          />
                          {photoPreview ? (
                            <div className="photo-chosen">
                              <img src={photoPreview} alt="" />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span className="hint">{photoFile?.name || 'Current photo'}</span>
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  style={{ alignSelf: 'flex-start' }}
                                  onClick={() => {
                                    setPhotoFile(null)
                                    setPhotoPreview(undefined)
                                    setPhotoId(undefined)
                                    if (fileRef.current) fileRef.current.value = ''
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="photo-add" onClick={() => fileRef.current?.click()}>
                              Take a photo or choose one
                            </button>
                          )}
                        </div>
                        <div className="field">
                          <label htmlFor="qa-src" className="lbl">
                            Original link
                          </label>
                          <input
                            id="qa-src"
                            className="fld"
                            type="url"
                            inputMode="url"
                            value={d.sourceUrl}
                            onChange={(e) => set('sourceUrl', e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {saveErr ? (
                <div role="alert" className="alert">
                  {saveErr}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
                <button type="button" className="btn btn--rust save-btn" onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Save changes' : 'Save to the book'}
                </button>
                <span className="hint" style={{ textAlign: 'center' }}>
                  {editing
                    ? 'Saving updates the recipe for everyone.'
                    : 'Saving publishes it right away. Unfinished work stays as a draft on this device.'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="preview">
          {screen === 'form' && showFields ? (
            <div className="preview-card">
              <span className="lbl">Preview</span>
              <span className="eyebrow" style={{ letterSpacing: '0.2em' }}>
                {chapterName}
              </span>
              <span className="t">{d.title || 'Untitled recipe'}</span>
              <div className="dbl" />
              {parsed.length ? (
                <ul>
                  {parsed.map((p, k) => (
                    <li key={k}>
                      <span className="q">{quantityLabel(p) || '—'}</span>
                      <span>{p.item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-i" style={{ margin: 0 }}>
                  Ingredients show here as you type them.
                </p>
              )}
              <span className="hint" style={{ marginTop: 6 }}>
                {stepLines.length} {stepLines.length === 1 ? 'step' : 'steps'} · amounts are read from the start of each line
              </span>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  )
}
