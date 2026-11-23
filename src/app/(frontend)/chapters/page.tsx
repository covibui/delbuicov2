import Link from 'next/link'
import { getChapters } from '@/lib/data'
import { toRoman } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contents' }

export default async function ContentsPage() {
  const chapters = await getChapters()
  const total = chapters.reduce((n, c) => n + (c.recipes?.docs?.length || 0), 0)
  return (
    <main className="wrap">
      <div className="sheet sheet--pad">
        <div className="sec-head" style={{ marginBottom: 0 }}>
          <h1 className="t-h1">Contents</h1>
          <span className="muted-i">
            {chapters.length} chapters · {total} recipes
          </span>
        </div>
        <div className="dbl" />
        <nav className="toc" aria-label="Chapters">
          {chapters.map((c) => {
            const n = c.recipes?.docs?.length || 0
            return (
              <Link key={c.id} href={`/chapters/${c.slug}`} className={n ? undefined : 'empty'}>
                <span className="num">{toRoman(c.order)}.</span>
                <span className="name">{c.title}</span>
                <span className="dots" />
                <span className="count">{n || 'empty'}</span>
              </Link>
            )
          })}
        </nav>
        <p className="muted-i" style={{ margin: '22px 0 0' }}>
          Empty chapters stay listed so new recipes have a place to go.
        </p>
      </div>
    </main>
  )
}
