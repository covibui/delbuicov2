import Link from 'next/link'
import { addedByName, chapterOf, getChapters, getCurrentUser, getPayloadClient, mediaUrl } from '@/lib/data'
import { toRoman } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payload = await getPayloadClient()
  const [chapters, user, newest, cooks] = await Promise.all([
    getChapters(),
    getCurrentUser(),
    payload.find({ collection: 'recipes', sort: '-createdAt', limit: 3, depth: 1 }),
    payload.count({ collection: 'users', overrideAccess: true }),
  ])
  const total = chapters.reduce((n, c) => n + (c.recipes?.docs?.length || 0), 0)
  const covers = chapters
    .map((c) => mediaUrl(c.cover, 'large'))
    .filter(Boolean)
    .slice(0, 6) as string[]

  return (
    <>
      <section className="hero">
        <div className="hero__text">
          <div className="label label--rust">Del Buico Kitchen · Family recipes</div>
          <h1>
            The Family <em>Cookbook</em>
          </h1>
          <p className="hero__lede">
            {total} recipes, {chapters.length} chapters, {cooks.totalDocs} cooks.
          </p>
          <div className="hero__actions">
            <Link className="btn" href="/chapters">
              Open the book
            </Link>
            {user ? (
              <Link className="btn btn--ghost" href="/add">
                Add a recipe
              </Link>
            ) : (
              <Link className="btn btn--ghost" href="/search">
                Find a recipe
              </Link>
            )}
          </div>
        </div>
        <div className="hero__plate" aria-hidden="true">
          {covers.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      </section>

      {newest.docs.length > 0 && (
        <>
          <div className="section-head">
            <h2>Newest pages</h2>
            <Link href="/search">All recipes</Link>
          </div>
          <div className="cards">
            {newest.docs.map((r, i) => {
              const ch = chapterOf(r)
              const by = addedByName(r)
              return (
                <Link key={r.id} href={`/recipes/${r.slug}`} className="card">
                  <span className="label label--rust">
                    {toRoman(i + 1)} · {ch?.title || 'Recipe'}
                  </span>
                  <h3>{r.title}</h3>
                  {r.intro ? <p>{r.intro.length > 140 ? r.intro.slice(0, 140) + '…' : r.intro}</p> : null}
                  <span className="card__foot">{by ? `From ${by}` : 'Read'} →</span>
                </Link>
              )
            })}
          </div>
        </>
      )}

      <div className="section-head">
        <h2>Chapters</h2>
        <Link href="/chapters">Contents</Link>
      </div>
      <div className="chapter-grid">
        {chapters.map((c) => {
          const count = c.recipes?.docs?.length || 0
          const img = mediaUrl(c.cover, 'card')
          return (
            <Link
              key={c.id}
              href={`/chapters/${c.slug}`}
              className={`chapter-tile${count ? '' : ' chapter-tile--empty'}`}
            >
              {img ? <img src={img} alt="" loading="lazy" /> : null}
              <div className="chapter-tile__body">
                <div className="chapter-tile__num">{toRoman(c.order)}</div>
                <div className="chapter-tile__title">{c.title}</div>
                <div className="chapter-tile__count">
                  {count ? `${count} recipe${count === 1 ? '' : 's'}` : 'Empty for now'}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
