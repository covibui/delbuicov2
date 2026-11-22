import { notFound, redirect } from 'next/navigation'
import { QuickAdd, type QuickAddInitial } from '@/components/QuickAdd'
import { canEdit, getChapters, getCurrentUser, getPayloadClient, mediaUrl } from '@/lib/data'
import { toRoman } from '@/lib/ingredients'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add a recipe' }

type Props = { searchParams: Promise<{ edit?: string; chapter?: string }> }

export default async function AddPage({ searchParams }: Props) {
  const { edit, chapter } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(edit ? `/add?edit=${edit}` : '/add')}`)

  const payload = await getPayloadClient()
  const [chapters, tags] = await Promise.all([getChapters(), payload.find({ collection: 'tags', sort: 'name', limit: 300 })])

  let initial: QuickAddInitial | undefined
  if (edit) {
    const recipe = await payload.findByID({ collection: 'recipes', id: Number(edit), depth: 1 }).catch(() => null)
    if (!recipe) notFound()
    if (!canEdit(user, recipe)) redirect(`/recipes/${recipe.slug}`)
    initial = {
      id: recipe.id,
      slug: recipe.slug || '',
      title: recipe.title,
      chapter: typeof recipe.chapter === 'object' ? recipe.chapter.id : recipe.chapter,
      ingredientsText: recipe.ingredientsText,
      stepsText: recipe.stepsText,
      equipmentText: recipe.equipmentText || '',
      intro: recipe.intro || '',
      notes: recipe.notes || '',
      servings: recipe.servings ?? undefined,
      prepMinutes: recipe.prepMinutes ?? undefined,
      cookMinutes: recipe.cookMinutes ?? undefined,
      sourceUrl: recipe.sourceUrl || '',
      tags: (recipe.tags || []).map((t) => (typeof t === 'object' ? t.id : t)),
      photoId: typeof recipe.photo === 'object' ? recipe.photo?.id : recipe.photo ?? undefined,
      photoUrl: mediaUrl(recipe.photo, 'thumb') || undefined,
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="label label--rust">{initial ? 'Edit page' : 'A new page for the book'}</div>
        <h1>{initial ? initial.title : <>Add a <em>recipe</em></>}</h1>
        {!initial ? <div className="flourish">paste a link, paste the text, or type it in</div> : null}
      </div>
      <div className="form-page">
        <QuickAdd
          chapters={chapters.map((c) => ({ id: c.id, label: `${toRoman(c.order)}. ${c.title}` }))}
          tags={tags.docs.map((t) => ({ id: t.id, name: t.name }))}
          initial={initial}
          defaultChapter={chapter ? Number(chapter) : undefined}
        />
      </div>
    </>
  )
}
