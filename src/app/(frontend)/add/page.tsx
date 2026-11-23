import { notFound, redirect } from 'next/navigation'
import { QuickAdd, type QuickAddInitial } from '@/components/QuickAdd'
import { canEdit, creditOf, getAllRecipes, getChapters, getCurrentUser, getPayloadClient, mediaUrl } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add a recipe' }

type Props = { searchParams: Promise<{ edit?: string; chapter?: string; title?: string }> }

export default async function AddPage({ searchParams }: Props) {
  const { edit, chapter, title } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(edit ? `/add?edit=${edit}` : '/add')}`)

  const payload = await getPayloadClient()
  const [chapters, tags, recipes, users] = await Promise.all([
    getChapters(),
    payload.find({ collection: 'tags', sort: 'name', limit: 300, depth: 0 }),
    getAllRecipes(),
    payload.find({ collection: 'users', limit: 200, overrideAccess: true, depth: 0, select: { name: true } }),
  ])

  // People who can be credited as the cook: family members plus anyone already credited.
  const cooks = [
    ...new Set([
      ...users.docs.map((u) => u.name?.trim()).filter(Boolean),
      ...recipes.map(creditOf).filter((c) => c !== 'Family recipe'),
    ]),
  ].sort((a, b) => a.localeCompare(b)) as string[]

  let initial: QuickAddInitial | undefined
  if (edit) {
    const recipe = await payload.findByID({ collection: 'recipes', id: Number(edit), depth: 1 }).catch(() => null)
    if (!recipe) notFound()
    if (!canEdit(user, recipe)) redirect(`/recipes/${recipe.slug}`)
    initial = {
      id: recipe.id,
      slug: recipe.slug || '',
      title: recipe.title,
      chapter: typeof recipe.chapter === 'object' ? recipe.chapter?.id : recipe.chapter ?? undefined,
      ingredientsText: recipe.ingredientsText,
      stepsText: recipe.stepsText || '',
      equipmentText: recipe.equipmentText || '',
      intro: recipe.intro || '',
      notes: recipe.notes || '',
      servings: recipe.servings ?? undefined,
      prepMinutes: recipe.prepMinutes ?? undefined,
      cookMinutes: recipe.cookMinutes ?? undefined,
      sourceUrl: recipe.sourceUrl || '',
      cookName: recipe.cookName || '',
      tags: (recipe.tags || []).map((t) => (typeof t === 'object' ? t.id : t)),
      photoId: typeof recipe.photo === 'object' ? recipe.photo?.id : recipe.photo ?? undefined,
      photoUrl: mediaUrl(recipe.photo, 'thumb') || undefined,
    }
  }

  return (
    <QuickAdd
      chapters={chapters.map((c) => ({ id: c.id, title: c.title }))}
      tags={tags.docs.map((t) => ({ id: t.id, name: t.name }))}
      cooks={cooks}
      me={user.name}
      initial={initial}
      defaultChapter={chapter ? Number(chapter) : undefined}
      defaultTitle={title}
    />
  )
}
