import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccountForm } from '@/components/AuthForms'
import { ImportButton } from '@/components/ImportButton'
import { getCurrentUser, getPayloadClient } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your account' }

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'recipes',
    where: { addedBy: { equals: user.id } },
    sort: 'title',
    limit: 500,
    select: { title: true, slug: true },
  })
  const totalRecipes = user.role === 'admin' ? (await payload.count({ collection: 'recipes' })).totalDocs : 1

  return (
    <>
      <div className="page-head">
        <div className="label label--rust">Your account</div>
        <h1>{user.name}</h1>
      </div>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <AccountForm id={user.id} name={user.name} email={user.email} />
        {user.role === 'admin' && totalRecipes === 0 ? <ImportButton /> : null}
        {user.role === 'admin' ? (
          <div className="notice" style={{ marginTop: 28 }}>
            You're the admin. Invite family and manage chapters in the <a href="/admin">admin panel</a>.
          </div>
        ) : null}
        <h2 className="block-title" style={{ marginTop: 40, fontSize: 26 }}>
          Your recipes ({docs.length})
        </h2>
        <div className="double-rule" />
        <ul className="recipe-list" style={{ padding: 0 }}>
          {docs.map((r) => (
            <li key={r.id}>
              <Link href={`/recipes/${r.slug}`}>
                <span className="recipe-list__title">{r.title}</span>
                <span className="label">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
