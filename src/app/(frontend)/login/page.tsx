import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/AuthForms'
import { getCurrentUser } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Log in' }

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/')
  return (
    <>
      <div className="page-head">
        <div className="label label--rust">Family only</div>
        <h1>Log in</h1>
        <div className="flourish">to add and edit recipes</div>
      </div>
      <div className="auth-card">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </>
  )
}
