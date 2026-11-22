import Link from 'next/link'
import { getChapters } from '@/lib/data'
import { toRoman } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contents' }

export default async function ContentsPage() {
  const chapters = await getChapters()
  const total = chapters.reduce((n, c) => n + (c.recipes?.docs?.length || 0), 0)
  return (
    <>
      <div className="page-head">
        <div className="label label--rust">Contents</div>
        <h1>
          The <em>Chapters</em>
        </h1>
        <div className="flourish">
          {chapters.length} chapters · {total} recipes
        </div>
      </div>
      <nav className="toc" aria-label="Chapters">
        {chapters.map((c) => {
          const count = c.recipes?.docs?.length || 0
          return (
            <Link
              key={c.id}
              href={`/chapters/${c.slug}`}
              className={`toc__item${count ? '' : ' toc__item--empty'}`}
            >
              <span className="toc__num">{toRoman(c.order)}.</span>
              <span className="toc__title">{c.title}</span>
              <span className="toc__count">{count || '—'}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
