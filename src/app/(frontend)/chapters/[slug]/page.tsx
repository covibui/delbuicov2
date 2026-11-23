import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChapterTable, type ChapterRow } from '@/components/ChapterTable'
import { chapterOf, creditOf, getAllRecipes, getChapters, getCurrentUser, mediaUrl, totalMinutes } from '@/lib/data'
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

  const [all, user] = await Promise.all([getAllRecipes(), getCurrentUser()])
  const rows: ChapterRow[] = all
    .filter((r) => chapterOf(r)?.id === chapter.id)
    .map((r) => ({
      slug: r.slug || '',
      title: r.title,
      cook: creditOf(r),
      prep: r.prepMinutes || 0,
      total: totalMinutes(r),
      serves: r.servings ?? null,
    }))
  const cover = mediaUrl(chapter.cover, 'large')
  const roman = toRoman(chapter.order)

  return (
    <main className="wrap">
      <div className="sheet sheet--pad">
        <Link href="/chapters" className="back">
          ← Contents
        </Link>
        <div className="chap-top">
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="eyebrow">Chapter {roman}</div>
            <h1 className="t-h1">{chapter.title}</h1>
            <p className="muted-i" style={{ margin: '8px 0 0' }}>
              {chapter.blurb || (rows.length ? `${rows.length} recipe${rows.length === 1 ? '' : 's'}` : 'No recipes yet')}
            </p>
          </div>
          <div className="chap-cover pattern">
            {cover ? <img src={cover} alt="" /> : <span className="pattern-label">Chapter cover</span>}
          </div>
        </div>

        {rows.length ? (
          <ChapterTable rows={rows} chapterName={chapter.title} />
        ) : (
          <div className="empty-box">
            <span className="mark">{roman}</span>
            <h2 style={{ fontSize: 28 }}>Nothing in {chapter.title} yet</h2>
            <p style={{ margin: 0, maxWidth: '36ch', color: 'var(--ink-2)' }}>
              Have a family recipe that belongs here? Add it and it shows up for everyone.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              <Link className="btn" href={user ? `/add?chapter=${chapter.id}` : `/login?next=/add`}>
                + Add the first recipe
              </Link>
              <Link className="btn btn--ghost" href="/chapters">
                Back to contents
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
