import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/AuthForms'
import { getChapters, getCurrentUser, getPayloadClient } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/')
  const payload = await getPayloadClient()
  const [chapters, recipes] = await Promise.all([getChapters(), payload.count({ collection: 'recipes' })])
  return (
    <div className="signin-page">
      <div className="signin-card">
        <div className="brand-panel">
          <span className="eyebrow">Family members only</span>
          <h1 className="t-hero">
            The DelBuiCo
            <br />
            <i>Cookbook</i>
          </h1>
          <p style={{ margin: '18px 0 0', fontStyle: 'italic', color: 'var(--ink-2)' }}>
            {recipes.totalDocs} recipes in {chapters.length} chapters
          </p>
          <p style={{ margin: '28px 0 0' }}>
            <Link href="/" className="small-link">
              ← Just reading? Open the book
            </Link>
          </p>
        </div>
        <div className="form-panel">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
