import { Suspense } from 'react'
import { SetPasswordForm } from '@/components/AuthForms'

export const metadata = { title: 'Set your password' }

export default function SetPasswordPage() {
  return (
    <>
      <div className="page-head">
        <div className="label label--rust">Welcome</div>
        <h1>
          Set your <em>password</em>
        </h1>
      </div>
      <div className="auth-card">
        <Suspense>
          <SetPasswordForm />
        </Suspense>
      </div>
    </>
  )
}
