/**
 * One-time import of the old Del Buico Kitchen site (covibui/delbuico-rb),
 * from the files in /seed. Used by the admin "Import old recipes" button
 * (POST /api/import-old-site) and by `npm run seed`.
 *
 * - groups.yml    → Chapters (all 24) + cover images
 * - tags.yml      → Tags
 * - authors.yml   → Users. "brianna" maps to the admin running the import (or
 *                   SEED_ADMIN_EMAIL from the script). Everyone else gets a
 *                   placeholder email (name@invite.pending) + random password.
 * - recipes/*.mdx → Recipes, credited to their original author
 *
 * Safe to run more than once: anything that already exists is skipped.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as yaml from 'js-yaml'
import type { Payload } from 'payload'
import { cleanText } from './ingredients'

export const SEED_DIR = path.resolve(process.cwd(), 'seed')

type OldTime = { time?: number; unit?: string } | null | undefined
type OldRecipe = {
  slug: string
  title: string
  author?: string
  group?: string
  prep_time?: OldTime
  cook_time?: OldTime
  servings?: { minimum?: number; maximum?: number } | null
  ingredients?: { item?: string; substitute?: string }[]
  directions?: { step?: string }[]
  materials?: { item?: string }[]
  pre_recipe_notes?: string
  post_recipe_notes?: string
  tags?: string[]
}

export type ImportOptions = {
  /** Existing admin account to credit Brianna's recipes to. */
  adminUserId?: number
  /** Script mode: create Brianna's admin account with these. */
  adminEmail?: string
  adminPassword?: string
}

export type ImportResult = { users: number; chapters: number; tags: number; recipes: number; skipped: number }

const readYaml = <T>(file: string): T => yaml.load(fs.readFileSync(path.join(SEED_DIR, file), 'utf8')) as T

function toMinutes(t: OldTime): number | undefined {
  if (!t || !t.time) return undefined
  const mult = t.unit === 'day' ? 1440 : t.unit === 'hour' ? 60 : 1
  return Math.round(Number(t.time) * mult)
}

const oneLine = (s?: string) => cleanText((s || '').replace(/\s*\n\s*/g, ' '))
const keepLines = (s?: string) =>
  (s || '')
    .split('\n')
    .map((l) => cleanText(l))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n')

export async function importOldSite(payload: Payload, opts: ImportOptions = {}): Promise<ImportResult> {
  const log = (m: string) => payload.logger.info(`[import] ${m}`)
  const result: ImportResult = { users: 0, chapters: 0, tags: 0, recipes: 0, skipped: 0 }

  // ---------- users ----------
  const { authors } = readYaml<{ authors: { slug: string; name: string }[] }>('authors.yml')
  const userIdByAuthor = new Map<string, number>()
  for (const a of authors) {
    const isBri = a.slug.toLowerCase() === 'brianna'
    if (isBri && opts.adminUserId) {
      userIdByAuthor.set(a.slug, opts.adminUserId)
      continue
    }
    const email = isBri && opts.adminEmail ? opts.adminEmail.toLowerCase() : `${a.slug.toLowerCase()}@invite.pending`
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      userIdByAuthor.set(a.slug, existing.docs[0].id)
      continue
    }
    const user = await payload.create({
      collection: 'users',
      data: {
        name: a.name,
        email,
        password: isBri && opts.adminPassword ? opts.adminPassword : crypto.randomBytes(24).toString('base64url'),
        role: isBri ? 'admin' : 'member',
      },
      overrideAccess: true,
    })
    userIdByAuthor.set(a.slug, user.id)
    result.users++
    log(`user: ${a.name} <${email}>`)
  }

  // ---------- chapters ----------
  const { groups } = readYaml<{ groups: { slug: string; name: string; image?: string }[] }>('groups.yml')
  // "Uncategorized" goes at the back of the book, not chapter I.
  const ordered = [...groups.filter((g) => g.slug !== 'uncategorized'), ...groups.filter((g) => g.slug === 'uncategorized')]
  const TITLE_FIXES: Record<string, string> = { 'hors-doevres': "Hors d'Oeuvres" }
  const chapterIdBySlug = new Map<string, number>()
  let order = 0
  for (const g of ordered) {
    order++
    const existing = await payload.find({
      collection: 'chapters',
      where: { slug: { equals: g.slug } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      chapterIdBySlug.set(g.slug, existing.docs[0].id)
      continue
    }
    let cover: number | undefined
    const img = g.image ? path.join(SEED_DIR, 'images', path.basename(g.image)) : ''
    if (img && fs.existsSync(img)) {
      const media = await payload.create({
        collection: 'media',
        data: { alt: g.name },
        filePath: img,
        overrideAccess: true,
      })
      cover = media.id
    }
    const chapter = await payload.create({
      collection: 'chapters',
      data: { title: TITLE_FIXES[g.slug] || cleanText(g.name.replace('’', "'")), slug: g.slug, order, cover },
      overrideAccess: true,
    })
    chapterIdBySlug.set(g.slug, chapter.id)
    result.chapters++
  }
  log(`chapters: ${result.chapters} created`)

  // ---------- tags ----------
  const { tags } = readYaml<{ tags: { slug: string; name: string }[] }>('tags.yml')
  const tagIdBySlug = new Map<string, number>()
  for (const t of tags || []) {
    const existing = await payload.find({
      collection: 'tags',
      where: { slug: { equals: t.slug } },
      limit: 1,
      overrideAccess: true,
    })
    let doc = existing.docs[0]
    if (!doc) {
      doc = await payload.create({ collection: 'tags', data: { name: t.name, slug: t.slug }, overrideAccess: true })
      result.tags++
    }
    tagIdBySlug.set(t.slug, doc.id)
  }

  // ---------- recipes ----------
  const files = fs.readdirSync(path.join(SEED_DIR, 'recipes')).filter((f) => f.endsWith('.mdx'))
  for (const file of files) {
    const text = fs.readFileSync(path.join(SEED_DIR, 'recipes', file), 'utf8')
    const r = yaml.load(text.split(/^---\s*$/m)[1]) as OldRecipe
    const exists = await payload.find({
      collection: 'recipes',
      where: { slug: { equals: r.slug } },
      limit: 1,
      overrideAccess: true,
    })
    if (exists.docs[0]) {
      result.skipped++
      continue
    }
    const chapter = chapterIdBySlug.get(r.group || '') ?? chapterIdBySlug.get('uncategorized')
    if (!chapter) {
      payload.logger.warn(`[import] skipped ${file}: unknown group ${r.group}`)
      result.skipped++
      continue
    }
    const ingredientsText = (r.ingredients || [])
      .map((i) => {
        const item = oneLine(i.item)
        const sub = oneLine(i.substitute)
        return sub ? `${item} | ${sub}` : item
      })
      .filter(Boolean)
      .join('\n')
    const stepsText = (r.directions || []).map((d) => oneLine(d.step)).filter(Boolean).join('\n')
    const equipmentText = (r.materials || []).map((m) => oneLine(m.item)).filter(Boolean).join('\n')

    await payload.create({
      collection: 'recipes',
      data: {
        title: cleanText(r.title),
        slug: r.slug,
        chapter,
        addedBy: userIdByAuthor.get(r.author || '') ?? userIdByAuthor.get('Miche'),
        servings: r.servings?.minimum || undefined,
        prepMinutes: toMinutes(r.prep_time),
        cookMinutes: toMinutes(r.cook_time),
        intro: keepLines(r.pre_recipe_notes) || undefined,
        notes: keepLines(r.post_recipe_notes) || undefined,
        ingredientsText: ingredientsText || '(none listed)',
        stepsText: stepsText || '(none listed)',
        equipmentText: equipmentText || undefined,
        tags: (r.tags || []).map((t) => tagIdBySlug.get(t)).filter((x): x is number => Boolean(x)),
      },
      overrideAccess: true,
    })
    result.recipes++
  }
  log(`recipes: ${result.recipes} created, ${result.skipped} skipped`)
  return result
}
