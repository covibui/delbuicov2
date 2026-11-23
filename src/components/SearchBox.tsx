'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

export type SearchItem = {
  slug: string
  title: string
  chapter: string
  cook: string
  tags: number[]
  text: string // ingredients, lowercased
}

type Props = {
  items: SearchItem[]
  chapters: string[]
  cooks: string[]
  tags: { id: number; name: string }[]
  initial: { q: string; chapter: string; cook: string; tag: string }
  signedIn: boolean
}

const TRIES = ['pork', 'rice', 'garlic', 'lime', 'coconut milk', 'chicken', 'beans', 'thyme']

/** Live search over the whole book (design: "Search" board). */
export function SearchBox({ items, chapters, cooks, tags, initial, signedIn }: Props) {
  const [q, setQ] = useState(initial.q)
  const [chapter, setChapter] = useState(initial.chapter)
  const [cook, setCook] = useState(initial.cook)
  const [tag, setTag] = useState(initial.tag)

  // Keep the address shareable without reloading.
  useEffect(() => {
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (chapter) p.set('chapter', chapter)
    if (cook) p.set('cook', cook)
    if (tag) p.set('tag', tag)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `/search?${qs}` : '/search')
  }, [q, chapter, cook, tag])

  const term = q.trim().toLowerCase()
  const anyFilter = Boolean(chapter || cook || tag)
  const searching = Boolean(term || anyFilter)

  const results = useMemo(() => {
    if (!searching) return []
    const words = term.split(/\s+/).filter(Boolean)
    const out: (SearchItem & { where: string })[] = []
    for (const r of items) {
      if (chapter && r.chapter !== chapter) continue
      if (cook && r.cook !== cook) continue
      if (tag && !r.tags.includes(Number(tag))) continue
      let where = 'Filter'
      if (words.length) {
        const title = r.title.toLowerCase()
        if (words.every((w) => title.includes(w))) where = 'Title'
        else if (words.every((w) => title.includes(w) || r.text.includes(w))) where = 'Ingredients'
        else continue
      }
      out.push({ ...r, where })
    }
    return out.sort(
      (a, b) => (a.where === 'Title' ? 0 : 1) - (b.where === 'Title' ? 0 : 1) || a.title.localeCompare(b.title),
    )
  }, [items, term, chapter, cook, tag, searching])

  const clearFilters = () => {
    setChapter('')
    setCook('')
    setTag('')
  }

  return (
    <>
      <label htmlFor="q" className="lbl">
        Search titles and ingredients
      </label>
      <div className="q-row">
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6F695F" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          id="q"
          className="q-input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="pork, rice, lime…"
          autoComplete="off"
          autoFocus={!initial.q && !initial.cook}
        />
        {q ? (
          <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label="Clear search">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3E3A33" strokeWidth="1.5">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="search-layout">
        <div className="facets">
          <div>
            <label htmlFor="f-ch" className="lbl">
              Chapter
            </label>
            <select id="f-ch" className="select" value={chapter} onChange={(e) => setChapter(e.target.value)}>
              <option value="">All chapters</option>
              {chapters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-cook" className="lbl">
              Cook
            </label>
            <select id="f-cook" className="select" value={cook} onChange={(e) => setCook(e.target.value)}>
              <option value="">Everyone</option>
              {cooks.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {tags.length ? (
            <div>
              <label htmlFor="f-tag" className="lbl">
                Tag
              </label>
              <select id="f-tag" className="select" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Any tag</option>
                {tags.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {anyFilter ? (
            <button
              type="button"
              className="toggle"
              style={{ alignSelf: 'flex-start', color: 'var(--rust)' }}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div style={{ minWidth: 0 }}>
          {!searching ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
              <div>
                <h2 style={{ fontSize: 26, marginBottom: 12 }}>Try an ingredient</h2>
                <div className="try-row">
                  {TRIES.map((t) => (
                    <button key={t} type="button" className="try" onClick={() => setQ(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {cooks.length ? (
                <div>
                  <h2 style={{ fontSize: 26, marginBottom: 12 }}>Or browse by cook</h2>
                  <div className="try-row">
                    {cooks.map((c) => (
                      <button key={c} type="button" className="try try--cook" onClick={() => setCook(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="muted-i" style={{ margin: 0 }}>
                Searching “garlic” finds every recipe that uses it, not only ones with garlic in the name.{' '}
                <Link href="/chapters">Browse all chapters</Link> instead.
              </p>
            </div>
          ) : results.length ? (
            <>
              <div className="sec-head" style={{ marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 24 }}>
                  {results.length} {results.length === 1 ? 'recipe' : 'recipes'}
                </span>
                {term ? <span className="hint">Title matches first</span> : null}
              </div>
              <div className="table-head search-grid">
                <span>Recipe</span>
                <span className="col-ch">Chapter</span>
                <span className="col-cook">Cook</span>
                <span style={{ textAlign: 'right' }}>{term ? 'Found in' : ''}</span>
              </div>
              {results.map((r) => (
                <Link key={r.slug} href={`/recipes/${r.slug}`} className="table-row search-grid">
                  <span style={{ minWidth: 0 }}>
                    <span className="t">{r.title}</span>
                    <span className="only-phone s">
                      {r.chapter} · {r.cook}
                    </span>
                  </span>
                  <span className="col-ch" style={{ fontSize: 16, color: 'var(--ink-2)' }}>
                    {r.chapter}
                  </span>
                  <span className="col-cook">{r.cook}</span>
                  <span className="found">{term ? r.where : ''}</span>
                </Link>
              ))}
            </>
          ) : (
            <div className="none-box">
              <h2>{term ? `No recipes match “${q.trim()}”` : 'No recipes match these filters'}</h2>
              <ul>
                {term ? <li>Check the spelling, or try one word.</li> : null}
                {term ? <li>Search an ingredient instead of a dish name.</li> : null}
                {anyFilter ? <li>Clear the filters to search the whole book.</li> : null}
              </ul>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                {term ? (
                  <Link className="btn" href={signedIn ? `/add?title=${encodeURIComponent(q.trim())}` : '/login?next=/add'}>
                    + Add “{q.trim()}” as a recipe
                  </Link>
                ) : null}
                {term ? (
                  <button type="button" className="btn btn--ghost" onClick={() => setQ('')}>
                    Clear search
                  </button>
                ) : (
                  <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
