import type { CollectionConfig, PayloadHandler } from 'payload'
import { adminOrOwner, anyone, loggedIn, isAdminUser } from '../access'
import { cleanText, parseIngredientsText, slugify, splitLines } from '../lib/ingredients'
import { fromJsonLd, titleFromHtml } from '../lib/recipeImport'

/** POST /api/recipes/import  { url }  → a draft for the Quick Add form (nothing is saved). */
const importFromUrl: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'Please log in first.' }, { status: 401 })
  let url = ''
  try {
    const body = req.json ? await req.json() : {}
    url = String(body?.url || '').trim()
  } catch {
    /* ignore */
  }
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ error: 'That doesn’t look like a web address.' }, { status: 400 })
  }
  let html = ''
  try {
    const res = await fetch(url, {
      headers: {
        // Many recipe sites refuse requests that don't look like a browser.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      return Response.json(
        { error: `That site said no (error ${res.status}). Try “Paste text” instead.` },
        { status: 422 },
      )
    }
    html = await res.text()
  } catch {
    return Response.json(
      { error: 'Couldn’t reach that page. Check the link, or use “Paste text” instead.' },
      { status: 422 },
    )
  }
  const draft = fromJsonLd(html, url)
  if (draft && (draft.ingredientsText || draft.stepsText)) return Response.json({ draft })
  return Response.json(
    {
      error:
        'That page doesn’t share its recipe in a format we can read. Copy the recipe text from the page and use “Paste text”.',
      draft: { title: titleFromHtml(html), ingredientsText: '', stepsText: '', sourceUrl: url },
    },
    { status: 422 },
  )
}

export const Recipes: CollectionConfig = {
  slug: 'recipes',
  labels: { singular: 'Recipe', plural: 'Recipes' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'chapter', 'addedBy', 'updatedAt'],
    listSearchableFields: ['title', 'ingredientsText'],
    description: 'Tip: the Quick Add page (/add) is easier on a phone.',
  },
  defaultSort: 'title',
  access: {
    read: anyone,
    create: loggedIn,
    update: adminOrOwner('addedBy'),
    delete: adminOrOwner('addedBy'),
  },
  endpoints: [{ path: '/import', method: 'post', handler: importFromUrl }],
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'chapter',
          type: 'relationship',
          relationTo: 'chapters',
          admin: { width: '50%', description: 'Leave empty for Uncategorized.' },
        },
        { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'servings', type: 'number', min: 1, admin: { width: '33%' } },
        { name: 'prepMinutes', label: 'Prep (minutes)', type: 'number', min: 0, admin: { width: '33%' } },
        { name: 'cookMinutes', label: 'Cook (minutes)', type: 'number', min: 0, admin: { width: '33%' } },
      ],
    },
    {
      name: 'intro',
      label: 'Intro note',
      type: 'textarea',
      admin: { description: 'Optional. A line about the dish, where it comes from, who makes it.' },
    },
    {
      name: 'ingredientsText',
      label: 'Ingredients',
      type: 'textarea',
      required: true,
      admin: {
        rows: 10,
        description: 'One ingredient per line, e.g. “1 1/2 cups rice”. Put a substitute after a | , e.g. “1 cup sugar | or honey”.',
      },
    },
    {
      name: 'equipmentText',
      label: 'Equipment',
      type: 'textarea',
      admin: { rows: 3, description: 'Optional. One item per line.' },
    },
    {
      name: 'stepsText',
      label: 'Steps',
      type: 'textarea',
      admin: { rows: 10, description: 'One step per line.' },
    },
    {
      name: 'notes',
      label: 'Closing notes',
      type: 'textarea',
      admin: { description: 'Optional. Tips, conversions, variations.' },
    },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'sourceUrl', label: 'Original link', type: 'text', admin: { position: 'sidebar' } },
    {
      name: 'addedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', description: 'Credited on the recipe page.' },
      access: {
        // members can't reassign credit; the admin can
        update: ({ req }) => isAdminUser(req.user as any),
      },
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            if (operation === 'create' && !value && req.user) return req.user.id
            return value
          },
        ],
      },
    },
    {
      name: 'cookName',
      label: 'Cook',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Whose recipe it is, if not the person who added it (e.g. Miche). Leave empty to credit whoever added it.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Part of the web address. Filled in automatically.' },
    },
    // Generated from ingredientsText on every save. Used by the serving scaler.
    {
      name: 'ingredients',
      type: 'array',
      admin: {
        readOnly: true,
        initCollapsed: true,
        description: 'Filled in automatically from the Ingredients box. Check here if a quantity scales oddly.',
      },
      fields: [
        { name: 'raw', type: 'text' },
        {
          type: 'row',
          fields: [
            { name: 'qty', type: 'number' },
            { name: 'qtyMax', type: 'number' },
            { name: 'unit', type: 'text' },
            { name: 'altQty', type: 'number' },
            { name: 'altUnit', type: 'text' },
          ],
        },
        { name: 'item', type: 'text' },
        { name: 'note', type: 'text' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (typeof data.title === 'string') data.title = cleanText(data.title)
        if (typeof data.cookName === 'string') data.cookName = cleanText(data.cookName)
        // No chapter picked (or cleared) → Uncategorized
        if (!data.chapter && (data.chapter !== undefined || !originalDoc?.chapter)) {
          const { docs } = await req.payload.find({
            collection: 'chapters',
            where: { slug: { equals: 'uncategorized' } },
            limit: 1,
            depth: 0,
            req,
            overrideAccess: true,
          })
          if (docs[0]) data.chapter = docs[0].id
        }
        if (typeof data.ingredientsText === 'string') {
          data.ingredients = parseIngredientsText(data.ingredientsText)
          data.ingredientsText = data.ingredients.map((i: { raw: string }) => i.raw).join('\n')
        }
        if (typeof data.stepsText === 'string') data.stepsText = splitLines(data.stepsText).join('\n')
        if (typeof data.equipmentText === 'string') data.equipmentText = splitLines(data.equipmentText).join('\n')

        // Unique, stable slug
        if (!data.slug && !originalDoc?.slug) {
          const base = slugify(data.title || 'recipe') || 'recipe'
          let slug = base
          for (let n = 2; n < 50; n++) {
            const { totalDocs } = await req.payload.count({
              collection: 'recipes',
              where: { slug: { equals: slug } },
              req,
              overrideAccess: true,
            })
            if (!totalDocs) break
            slug = `${base}-${n}`
          }
          data.slug = slug
        }
        return data
      },
    ],
  },
}
