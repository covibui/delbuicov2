import { SearchBox, type SearchItem } from '@/components/SearchBox'
import { chapterOf, creditOf, getAllRecipes, getChapters, getCurrentUser, getPayloadClient, tagsOf } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Search' }

type Props = { searchParams: Promise<{ q?: string; chapter?: string; cook?: string; tag?: string }> }

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams
  const payload = await getPayloadClient()
  const [recipes, chapters, tags, user] = await Promise.all([
    getAllRecipes(),
    getChapters(),
    payload.find({ collection: 'tags', sort: 'name', limit: 300, depth: 0 }),
    getCurrentUser(),
  ])

  const items: SearchItem[] = recipes.map((r) => ({
    slug: r.slug || '',
    title: r.title,
    chapter: chapterOf(r)?.title || '',
    cook: creditOf(r),
    tags: tagsOf(r).map((t) => t.id),
    text: (r.ingredientsText || '').toLowerCase(),
  }))
  // Only offer chapters, cooks and tags that actually have recipes.
  const usedChapters = chapters.map((c) => c.title).filter((t) => items.some((i) => i.chapter === t))
  const cooks = [...new Set(items.map((i) => i.cook))].sort((a, b) =>
    a === 'Family recipe' ? 1 : b === 'Family recipe' ? -1 : a.localeCompare(b),
  )
  const usedTags = tags.docs.filter((t) => items.some((i) => i.tags.includes(t.id))).map((t) => ({ id: t.id, name: t.name }))

  // Older links used a chapter id; accept both.
  const chapterParam = sp.chapter ? chapters.find((c) => String(c.id) === sp.chapter)?.title || sp.chapter : ''

  return (
    <main className="wrap">
      <div className="sheet sheet--pad">
        <SearchBox
          items={items}
          chapters={usedChapters}
          cooks={cooks}
          tags={usedTags}
          initial={{ q: sp.q || '', chapter: chapterParam, cook: sp.cook || '', tag: sp.tag || '' }}
          signedIn={Boolean(user)}
        />
      </div>
    </main>
  )
}
