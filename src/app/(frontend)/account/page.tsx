import { redirect } from 'next/navigation'
import { MyAccount } from '@/components/MyAccount'
import { chapterOf, getCurrentUser, getPayloadClient } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your account' }

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')
  const payload = await getPayloadClient()
  const [{ docs }, total] = await Promise.all([
    payload.find({
      collection: 'recipes',
      where: { addedBy: { equals: user.id } },
      sort: 'title',
      limit: 1000,
      depth: 1,
      overrideAccess: true,
    }),
    payload.count({ collection: 'recipes', overrideAccess: true }),
  ])

  return (
    <MyAccount
      id={user.id}
      name={user.name}
      email={user.email}
      hideName={Boolean(user.hideName)}
      isAdmin={user.role === 'admin'}
      showImport={user.role === 'admin' && total.totalDocs === 0}
      recipes={docs.map((r) => ({
        id: r.id,
        slug: r.slug || '',
        title: r.title,
        chapter: chapterOf(r)?.title || 'Uncategorized',
        // Credit as if the name were shown; the component swaps in "Family recipe" when hidden.
        credit: r.cookName?.trim() || user.name,
      }))}
    />
  )
}
