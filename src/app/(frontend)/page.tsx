import Link from 'next/link'
import type { Recipe } from '@/payload-types'
import {
  chapterOf,
  creditOf,
  getAllRecipes,
  getChapters,
  getCurrentUser,
  getPayloadClient,
  ingredientCount,
  mediaUrl,
  stepCount,
  totalMinutes,
} from '@/lib/data'
import { formatMinutes } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** Same recipe all week, changes every Monday. Prefers recipes with a photo. */
function pickOfTheWeek(recipes: Recipe[]): Recipe | undefined {
  if (!recipes.length) return undefined
  const withPhoto = recipes.filter((r) => mediaUrl(r.photo))
  const pool = withPhoto.length ? withPhoto : recipes
  const week = Math.floor((Date.now() / 86400000 + 3) / 7) // weeks since a Monday
  return pool[week % pool.length]
}

function featuredMeta(r: Recipe) {
  const parts = [creditOf(r)]
  if (r.servings) parts.push(`Serves ${r.servings}`)
  if ((r.prepMinutes || 0) >= 1440) parts.push(`Start ${formatMinutes(r.prepMinutes)} ahead`)
  else if (totalMinutes(r)) parts.push(`Ready in ${formatMinutes(totalMinutes(r))}`)
  return parts.join(' · ')
}

export default async function HomePage() {
  const payload = await getPayloadClient()
  const [chapters, recipes, user, users] = await Promise.all([
    getChapters(),
    getAllRecipes(),
    getCurrentUser(),
    payload.find({ collection: 'users', limit: 200, overrideAccess: true, depth: 0, select: { name: true, hideName: true } }),
  ])

  // Cooks: everyone credited on a recipe, plus family members with none yet.
  const counts = new Map<string, number>()
  for (const r of recipes) {
    const c = creditOf(r)
    if (c !== 'Family recipe') counts.set(c, (counts.get(c) || 0) + 1)
  }
  for (const u of users.docs) {
    const first = u.name?.trim()
    if (first && !u.hideName && !counts.has(first)) counts.set(first, 0)
  }
  const cooks = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const activeCooks = cooks.filter(([, n]) => n > 0).map(([n]) => n)

  const featured = pickOfTheWeek(recipes)
  const featuredCh = featured ? chapterOf(featured) : null
  const featuredPhoto = featured ? mediaUrl(featured.photo, 'large') : null

  const newest = [...recipes].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 3)
  const mosaicPool = recipes.filter((r) => r.id !== featured?.id && !newest.some((n) => n.id === r.id))
  const mosaic = [...mosaicPool.filter((r) => mediaUrl(r.photo)), ...mosaicPool.filter((r) => !mediaUrl(r.photo))].slice(0, 4)

  const byCount = [...chapters].sort(
    (a, b) => (b.recipes?.docs?.length || 0) - (a.recipes?.docs?.length || 0) || a.order - b.order,
  )
  const topChapters = byCount.filter((c) => (c.recipes?.docs?.length || 0) > 0).slice(0, 6)
  const biggest = byCount[0]
  const biggestTitles = recipes
    .filter((r) => chapterOf(r)?.id === biggest?.id)
    .map((r) => r.title)
    .sort((a, b) => a.localeCompare(b))
  const biggestCover = mediaUrl(biggest?.cover, 'large')

  return (
    <main className="wrap">
      <div className="sheet">
        <section className="hero">
          <div className="hero-text">
            <h1 className="t-hero">
              The DelBuiCo
              <br />
              Cookbook
            </h1>
            <p style={{ margin: '22px 0 0', fontSize: 20, color: 'var(--ink-2)', maxWidth: '30ch' }}>
              {recipes.length} family recipes in {chapters.length} chapters
              {activeCooks.length ? `, from ${listNames(activeCooks.slice(0, 4))}` : ''}.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
              <Link className="btn" href="/chapters">
                Browse chapters
              </Link>
              <Link className="btn btn--ghost" href={user ? '/add' : '/login?next=/add'}>
                + Add a recipe
              </Link>
            </div>
          </div>
          {featured ? (
            <Link href={`/recipes/${featured.slug}`} className="hero-photo">
              {featuredPhoto ? <img src={featuredPhoto} alt="" /> : null}
              <span className="tag-card">
                <span className="eyebrow" style={{ fontSize: 10, letterSpacing: '0.2em' }}>
                  Featured · {featuredCh?.title}
                </span>
                <span className="t">{featured.title}</span>
              </span>
            </Link>
          ) : (
            <div className="hero-photo" />
          )}
        </section>

        <blockquote className="sec" style={{ margin: 0, textAlign: 'center' }}>
          <p className="quote">“To the good times.”</p>
          <span className="eyebrow" style={{ display: 'inline-block', marginTop: 14, letterSpacing: '0.2em' }}>
            Michael Covil
          </span>
        </blockquote>

        {featured ? (
          <section className="band">
            <div className="band-photo pattern">
              {featuredPhoto ? <img src={featuredPhoto} alt="" /> : <span className="pattern-label">No photo yet</span>}
            </div>
            <div className="band-card">
              <span className="eyebrow">Featured · {featuredCh?.title}</span>
              <h2>{featured.title}</h2>
              <p>{featuredMeta(featured)}</p>
              <p className="muted-i">
                {ingredientCount(featured)} {ingredientCount(featured) === 1 ? 'ingredient' : 'ingredients'},{' '}
                {stepCount(featured)} {stepCount(featured) === 1 ? 'step' : 'steps'}.
                {(featured.prepMinutes || 0) >= 1440 ? ' Starts the day before, so read it through first.' : ''}
              </p>
              <Link className="btn" href={`/recipes/${featured.slug}`}>
                Open recipe
              </Link>
            </div>
          </section>
        ) : null}

        <section className="sec sec--rule">
          <div className="sec-head">
            <h2 className="t-h2">Newest</h2>
            <Link href="/search" className="small-link">
              Search all recipes →
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
            <div className="newest-list">
              {newest.map((r) => (
                <Link key={r.id} href={`/recipes/${r.slug}`} className="newest-item">
                  <span className="eyebrow">{chapterOf(r)?.title}</span>
                  <span className="t">{r.title}</span>
                  <span className="m">
                    {[creditOf(r), formatMinutes(totalMinutes(r)), `${ingredientCount(r)} ingredients`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              ))}
            </div>
            {mosaic.length ? (
              <div className="mosaic">
                {mosaic.map((r) => {
                  const img = mediaUrl(r.photo, 'card')
                  return (
                    <Link key={r.id} href={`/recipes/${r.slug}`} className="pattern">
                      {img ? <img src={img} alt="" /> : null}
                      <span>{r.title}</span>
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="sec sec--rule">
          <div className="sec-head">
            <h2 className="t-h2">The cooks</h2>
            <span className="muted-i">Pick a name to see their recipes</span>
          </div>
          <div className="cooks">
            {cooks.map(([name, n]) => (
              <Link key={name} href={`/search?cook=${encodeURIComponent(name)}`}>
                <span className="n">{name}</span>
                <span className="c">{n === 0 ? 'None yet' : `${n} recipe${n === 1 ? '' : 's'}`} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="sec sec--rule">
          <div className="sec-head">
            <h2 className="t-h2">Chapters</h2>
            <Link href="/chapters" className="small-link">
              All {chapters.length} chapters →
            </Link>
          </div>
          <div className="chap-row">
            <div className="chap-list">
              {topChapters.map((c) => {
                const n = c.recipes?.docs?.length || 0
                const img = mediaUrl(c.cover, 'thumb')
                return (
                  <Link key={c.id} href={`/chapters/${c.slug}`}>
                    <span className="chap-thumb">{img ? <img src={img} alt="" /> : null}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span className="t">{c.title}</span>
                      <span className="lbl" style={{ letterSpacing: '0.18em' }}>
                        {n} recipe{n === 1 ? '' : 's'}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
            {biggest ? (
              <div className="chap-feature">
                <div className="chap-photo pattern">
                  {biggestCover ? <img src={biggestCover} alt="" /> : <span className="pattern-label">Chapter cover</span>}
                </div>
                <div className="chap-card">
                  <span className="eyebrow">Biggest chapter</span>
                  <h3>{biggest.title}</h3>
                  <p className="muted-i">
                    {biggestTitles.length} recipes
                    {biggestTitles.length > 1
                      ? `, from ${biggestTitles[0].toLowerCase()} to ${biggestTitles[biggestTitles.length - 1].toLowerCase()}.`
                      : '.'}
                  </p>
                  <Link className="btn btn--ghost btn--sm" href={`/chapters/${biggest.slug}`}>
                    Open chapter
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="foot">
          <span className="brand">
            The DelBuiCo <i>Cookbook</i>
          </span>
          <nav aria-label="Footer">
            <Link href="/chapters">Chapters</Link>
            <Link href="/search">Search</Link>
            <Link href="/add">Add a recipe</Link>
            {user?.role === 'admin' ? <a href="/admin">Admin</a> : null}
          </nav>
        </footer>
      </div>
    </main>
  )
}
