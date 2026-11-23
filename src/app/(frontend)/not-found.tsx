import { ErrorPage } from '@/components/ErrorPage'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return <ErrorPage code="404" variant="not-found" />
}
