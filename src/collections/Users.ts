import type { CollectionConfig, PayloadHandler } from 'payload'
import { adminField, adminOnly, isAdminUser, loggedIn } from '../access'

/**
 * POST /api/users/leave  { recipes: 'keep' | 'delete' }
 * Deletes your own account. 'keep' leaves your recipes in the book credited to
 * "Family recipe"; 'delete' removes them too. The last admin can't leave.
 */
const leave: PayloadHandler = async (req) => {
  const user = req.user as { id: number; name?: string; role?: string } | null
  if (!user) return Response.json({ error: 'Please sign in first.' }, { status: 401 })
  let mode = 'keep'
  try {
    const body = req.json ? await req.json() : {}
    if (body?.recipes === 'delete') mode = 'delete'
  } catch {
    /* default keep */
  }
  const { payload } = req
  if (user.role === 'admin') {
    const { totalDocs } = await payload.count({ collection: 'users', where: { role: { equals: 'admin' } }, overrideAccess: true })
    if (totalDocs <= 1) {
      return Response.json(
        { error: 'You are the only admin. Make someone else an admin in the admin panel first.' },
        { status: 400 },
      )
    }
  }
  const mine = await payload.find({
    collection: 'recipes',
    where: { addedBy: { equals: user.id } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  for (const r of mine.docs) {
    if (mode === 'delete') {
      await payload.delete({ collection: 'recipes', id: r.id, overrideAccess: true })
    } else {
      const ownName = (r.cookName || '').trim().toLowerCase() === (user.name || '').trim().toLowerCase()
      await payload.update({
        collection: 'recipes',
        id: r.id,
        data: { addedBy: null, ...(ownName ? { cookName: '' } : {}) },
        overrideAccess: true,
      })
    }
  }
  await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  const res = Response.json({ ok: true, recipes: mine.docs.length, mode })
  res.headers.append('Set-Cookie', 'payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')
  return res
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Family member', plural: 'Family' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    description:
      'To add someone: Create new → their name, email and a temporary password → Save. Give them the password; they can change it on their Account page. Forgot a password? Open their entry here and type a new one.',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 30, // stay logged in for 30 days
  },
  endpoints: [{ path: '/leave', method: 'post', handler: leave }],
  access: {
    read: loggedIn,
    create: adminOnly,
    update: ({ req, id }) => {
      if (!req.user) return false
      if (isAdminUser(req.user as any)) return true
      return String(req.user.id) === String(id)
    },
    delete: adminOnly,
    admin: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Admin (can edit everything, add family members)', value: 'admin' },
        { label: 'Family member (adds and edits own recipes)', value: 'member' },
      ],
      access: { update: adminField, create: adminField },
      saveToJWT: true,
    },
    {
      name: 'hideName',
      label: 'Show “Family recipe” instead of my name on my recipes',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // The very first account becomes the admin.
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', req })
          if (totalDocs === 0) data.role = 'admin'
        }
        return data
      },
    ],
  },
}
