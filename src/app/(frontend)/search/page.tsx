import Link from 'next/link'
import type { Where } from 'payload'
import type { Recipe } from '@/payload-types'
import { chapterOf, addedByName, getChapters, getPayloadClient } from '@/lib/data'
import { toRoman } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Search' }

type Props = { searchParams: Promise<{ q?: string; chapter?: string; by?: string; tag?: string }> }

export default async function SearchPage({ searchParams }: Props) {
  const { q = '', chapter = '', by = '', tag = '' } = await searchParams
  const payload = await getPayloadClient()
  const [chapters, users, tags] = await Promise.all([
    getChapters(),
    payload.find({ collection: 'users', sort: 'name', limit: 200, overrideAccess: true, select: { name: true } }),
    payload.find({ collection: 'tags', sort: 'name', limit: 200 }),
  ])

  const and: Where[] = []
  const term = q.trim()
  if (term) {
    // every word must appear in the title or the ingredients
    for (const word of term.split(/\s+/).slice(0, 6)) {
      and.push({ or: [{ title: { like: word } }, { ingredientsText: { like: word } }] })
    }
  }
  if (chapter) and.push({ chapter: { equals: Number(chapter) } })
  if (by) and.push({ addedBy: { equals: Number(by) } })
  if (tag) and.push({ tags: { contains: Number(tag) } })

  const { docs, totalDocs } = await payload.find({
    collection: 'recipes',
    where: and.length ? { and } : undefined,
    sort: 'title',
    limit: 200,
    depth: 1,
  })

  return (
    <>
      <div className="page-head">
        <div className="label label--rust">Search the book</div>
        <h1>
          Find a <em>recipe</em>
        </h1>
      </div>

      <form className="search-form" action="/search" method="get" role="search">
        <div className="search-form__row">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Dish or ingredient, e.g. “plantain”"
            aria-label="Search recipes"
          />
          <button className="btn" type="submit">
            Search
          </button>
        </div>
        <div className="filters">
          <select className="select" name="chapter" defaultValue={chapter} aria-label="Chapter">
            <option value="">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {toRoman(c.order)}. {c.title}
              </option>
            ))}
          </select>
          <select className="select" name="by" defaultValue={by} aria-label="Added by">
            <option value="">Anyone</option>
            {users.docs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {tags.docs.length ? (
            <select className="select" name="tag" defaultValue={tag} aria-label="Tag">
              <option value="">Any tag</option>
              {tags.docs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </form>

      <p className="result-count label">
        {totalDocs} recipe{totalDocs === 1 ? '' : 's'}
        {term ? ` matching “${term}”` : ''}
      </p>
      {docs.length ? (
        <ol className="recipe-list" style={{ paddingTop: 0 }}>
          {docs.map((r: Recipe) => {
            const ch = chapterOf(r)
            const who = addedByName(r)
            return (
              <li key={r.id}>
                <Link href={`/recipes/${r.slug}`}>
                  <span className="recipe-list__title">
                    {r.title}
                    <small>
                      {ch?.title}
                      {who ? ` · from ${who}` : ''}
                    </small>
                  </span>
                  <span className="recipe-list__num">{ch ? toRoman(ch.order) : ''}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="empty">Nothing found. Try a single ingredient.</div>
      )}
    </>
  )
}
