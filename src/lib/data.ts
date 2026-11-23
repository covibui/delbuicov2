import 'server-only'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cache } from 'react'
import type { Chapter, Media, Recipe, Tag, User } from '@/payload-types'
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

/** Every recipe with its chapter, adder and tags: the book is small enough to load whole. */
export const getAllRecipes = cache(async () => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'recipes',
    sort: 'title',
    limit: 1000,
    depth: 1,
    overrideAccess: true,
  })
  return docs
})

export function mediaUrl(m: Media | number | null | undefined, size: 'thumb' | 'card' | 'large' = 'card') {
  if (!m || typeof m !== 'object') return null
  return m.sizes?.[size]?.url || m.url || null
}

export function chapterOf(r: Recipe): Chapter | null {
  return typeof r.chapter === 'object' && r.chapter ? r.chapter : null
}

function adderOf(r: Recipe): User | null {
  return typeof r.addedBy === 'object' && r.addedBy ? r.addedBy : null
}

/** The name a recipe is credited to: its Cook, else whoever added it, else "Family recipe". */
export function creditOf(r: Recipe): string {
  const adder = adderOf(r)
  const cook = (r.cookName || '').trim()
  if (cook) {
    // Someone who hid their name stays hidden even if they typed it as the cook.
    if (adder?.hideName && cook.toLowerCase() === adder.name.trim().toLowerCase()) return 'Family recipe'
    return cook
  }
  if (adder && !adder.hideName) return adder.name
  return 'Family recipe'
}

/** "by Miche · added by Bri from a link" */
export function bylineOf(r: Recipe): string {
  const credit = creditOf(r)
  const adder = adderOf(r)
  const parts = [credit === 'Family recipe' ? 'Family recipe' : `by ${credit}`]
  const adderShown = adder && !adder.hideName && adder.name !== credit
  if (adderShown) parts.push(`added by ${adder!.name.split(' ')[0]}${r.sourceUrl ? ' from a link' : ''}`)
  else if (r.sourceUrl) parts.push('from a link')
  return parts.join(' · ')
}

export const tagsOf = (r: Recipe) => (r.tags || []).filter((t): t is Tag => typeof t === 'object')

export const totalMinutes = (r: Recipe) => (r.prepMinutes || 0) + (r.cookMinutes || 0)

export const ingredientCount = (r: Recipe) => (r.ingredients || []).length

export function stepCount(r: Recipe) {
  return (r.stepsText || '').split('\n').filter((l) => l.trim()).length
}

/** Chapter numeral, e.g. "XV" */
export const romanOf = (c: Chapter | null | undefined) => (c ? toRoman(c.order) : '')
