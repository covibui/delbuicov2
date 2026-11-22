/**
 * One-time import of the old Del Buico Kitchen site (covibui/delbuico-rb).
 *
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run seed
 *
 * - groups.yml   → Chapters (all 24, in the same order) + cover images
 * - tags.yml     → Tags
 * - authors.yml  → Users. "brianna" becomes the admin account using
 *                  SEED_ADMIN_EMAIL; everyone else gets a placeholder email
 *                  (name@invite.pending) and a random password. Change their
 *                  email in the admin, then tick "Send invite email".
 * - recipes/*.mdx → Recipes, credited to their original author
 *
 * Safe to run more than once: anything that already exists is skipped.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as yaml from 'js-yaml'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cleanText } from '../lib/ingredients'

const SEED_DIR = path.resolve(process.cwd(), 'seed')

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

const readYaml = <T>(file: string): T => yaml.load(fs.readFileSync(path.join(SEED_DIR, file), 'utf8')) as T

function toMinutes(t: OldTime): number | undefined {
  if (!t || !t.time) return undefined
  const mult = t.unit === 'day' ? 1440 : t.unit === 'hour' ? 60 : 1
  return Math.round(Number(t.time) * mult)
}

/** Collapse a multi-line YAML block into tidy text. */
const oneLine = (s?: string) => cleanText((s || '').replace(/\s*\n\s*/g, ' '))
const keepLines = (s?: string) =>
  (s || '')
    .split('\n')
    .map((l) => cleanText(l))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n')

async function run() {
  const payload = await getPayload({ config })
  const log = (m: string) => payload.logger.info(m)

  // ---------- users ----------
  const { authors } = readYaml<{ authors: { slug: string; name: string }[] }>('authors.yml')
  const userIdByAuthor = new Map<string, number>()
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  for (const a of authors) {
    const isBri = a.slug.toLowerCase() === 'brianna'
    const email = isBri && adminEmail ? adminEmail.toLowerCase() : `${a.slug.toLowerCase()}@invite.pending`
    const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
    if (existing.docs[0]) {
      userIdByAuthor.set(a.slug, existing.docs[0].id)
      continue
    }
    const user = await payload.create({
      collection: 'users',
      data: {
        name: a.name,
        email,
        password: isBri && adminPassword ? adminPassword : crypto.randomBytes(24).toString('base64url'),
        role: isBri ? 'admin' : 'member',
      },
      overrideAccess: true,
    })
    userIdByAuthor.set(a.slug, user.id)
    log(`user: ${a.name} <${email}>${isBri ? ' (admin)' : ''}`)
  }
  if (!adminEmail) log('SEED_ADMIN_EMAIL not set: Brianna got a placeholder email. Update it in the admin.')

  // ---------- chapters ----------
  const { groups } = readYaml<{ groups: { slug: string; name: string; image?: string }[] }>('groups.yml')
  const chapterIdBySlug = new Map<string, number>()
  // "Uncategorized" goes at the back of the book, not chapter I.
  const ordered = [...groups.filter((g) => g.slug !== 'uncategorized'), ...groups.filter((g) => g.slug === 'uncategorized')]
  const TITLE_FIXES: Record<string, string> = { 'hors-doevres': "Hors d'Oeuvres" }
  let order = 0
  for (const g of ordered) {
    order++
    const existing = await payload.find({ collection: 'chapters', where: { slug: { equals: g.slug } }, limit: 1 })
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
    log(`chapter ${order}: ${g.name}`)
  }

  // ---------- tags ----------
  const { tags } = readYaml<{ tags: { slug: string; name: string }[] }>('tags.yml')
  const tagIdBySlug = new Map<string, number>()
  for (const t of tags || []) {
    const existing = await payload.find({ collection: 'tags', where: { slug: { equals: t.slug } }, limit: 1 })
    const doc =
      existing.docs[0] ||
      (await payload.create({ collection: 'tags', data: { name: t.name, slug: t.slug }, overrideAccess: true }))
    tagIdBySlug.set(t.slug, doc.id)
  }

  // ---------- recipes ----------
  const files = fs.readdirSync(path.join(SEED_DIR, 'recipes')).filter((f) => f.endsWith('.mdx'))
  let created = 0
  for (const file of files) {
    const text = fs.readFileSync(path.join(SEED_DIR, 'recipes', file), 'utf8')
    const fm = text.split(/^---\s*$/m)[1]
    const r = yaml.load(fm) as OldRecipe
    const exists = await payload.find({ collection: 'recipes', where: { slug: { equals: r.slug } }, limit: 1 })
    if (exists.docs[0]) continue

    const chapter = chapterIdBySlug.get(r.group || '') ?? chapterIdBySlug.get('uncategorized')
    if (!chapter) {
      payload.logger.warn(`skipped ${file}: unknown group ${r.group}`)
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
    const stepsText = (r.directions || [])
      .map((d) => oneLine(d.step))
      .filter(Boolean)
      .join('\n')
    const equipmentText = (r.materials || [])
      .map((m) => oneLine(m.item))
      .filter(Boolean)
      .join('\n')

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
    created++
  }
  log(`recipes: ${created} created, ${files.length - created} already there`)
  process.exit(0)
}

// Top-level await: `payload run` exits as soon as the module finishes loading.
try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
