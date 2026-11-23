import { ErrorPage } from '@/components/ErrorPage'

export const metadata = { title: 'Recipe not found' }

export default function RecipeGone() {
  return <ErrorPage code="410" variant="recipe-gone" />
}
