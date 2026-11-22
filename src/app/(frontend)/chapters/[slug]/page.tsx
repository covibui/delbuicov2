import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Recipe, User } from '@/payload-types'
import { getChapters, getCurrentUser, getPayloadClient } from '@/lib/data'
import { toRoman } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const ch = (await getChapters()).find((c) => c.slug === slug)
  return { title: ch?.title || 'Chapter' }
}

export default async function ChapterPage({ params }: Props) {
  const { slug } = await params
  const chapters = await getChapters()
  const chapter = chapters.find((c) => c.slug === slug)
  if (!chapter) notFound()

  const payload = await getPayloadClient()
  const user = await getCurrentUser()
  // Alphabetical, numbered like a cookbook.
  const { docs: recipes } = await payload.find({
    collection: 'recipes',
    where: { chapter: { equals: chapter.id } },
    sort: 'title',
    limit: 500,
    depth: 1,
    select: { title: true, slug: true, addedBy: true },
  })

  return (
    <>
      <div className="page-head">
        <div className="label label--rust">Chapter {toRoman(chapter.order)}</div>
        <h1>{chapter.title}</h1>
        {chapter.blurb ? <div className="flourish">{chapter.blurb}</div> : null}
        <div className="label" style={{ marginTop: 18 }}>
          {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
        </div>
      </div>

      {recipes.length ? (
        <ol className="recipe-list">
          {recipes.map((r: Partial<Recipe>, i) => {
            const by = typeof r.addedBy === 'object' ? (r.addedBy as User | null)?.name : null
            return (
              <li key={r.id}>
                <Link href={`/recipes/${r.slug}`}>
                  <span className="recipe-list__title">
                    {r.title}
                    {by ? <small>from {by}</small> : null}
                  </span>
                  <span className="recipe-list__num">
                    {toRoman(chapter.order)} · {i + 1}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="empty">
          <p>No recipes in this chapter yet.</p>
          {user ? (
            <Link className="btn btn--ghost" href={`/add?chapter=${chapter.id}`}>
              Add the first one
            </Link>
          ) : null}
        </div>
      )}
    </>
  )
}
