import 'server-only'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cache } from 'react'
import type { Chapter, Media, Recipe, User } from '@/payload-types'
import { toRoman } from './ingredients'

export const getPayloadClient = cache(() => getPayload({ config }))

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const payload = await getPayloadClient()
  try {
    const { user } = await payload.auth({ headers: await headers() })
    return (user as User) ?? null
  } catch {
    return null
  }
})

export const canEdit = (user: User | null, recipe: Recipe) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const owner = typeof recipe.addedBy === 'object' ? recipe.addedBy?.id : recipe.addedBy
  return owner === user.id
}

export const getChapters = cache(async () => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'chapters',
    sort: 'order',
    limit: 100,
    depth: 1,
    joins: { recipes: { limit: 500, sort: 'title' } },
  })
  return docs
})

/** Cookbook-style number: chapter numeral · position (alphabetical within the chapter). */
export async function recipeNumber(recipe: Recipe): Promise<string> {
  const chapterId = typeof recipe.chapter === 'object' ? recipe.chapter.id : recipe.chapter
  const chapters = await getChapters()
  const ch = chapters.find((c) => c.id === chapterId)
  if (!ch) return ''
  const ids = (ch.recipes?.docs || []).map((r) => (typeof r === 'object' ? r.id : r))
  const idx = ids.indexOf(recipe.id)
  return `${toRoman(ch.order)} · ${idx >= 0 ? idx + 1 : '–'}`
}

export function mediaUrl(m: Media | number | null | undefined, size: 'thumb' | 'card' | 'large' = 'card') {
  if (!m || typeof m !== 'object') return null
  return m.sizes?.[size]?.url || m.url || null
}

export function chapterOf(r: Recipe): Chapter | null {
  return typeof r.chapter === 'object' ? r.chapter : null
}

export function addedByName(r: Recipe): string | null {
  return typeof r.addedBy === 'object' && r.addedBy ? r.addedBy.name : null
}
