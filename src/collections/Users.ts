import type { CollectionConfig } from 'payload'
import { adminField, adminOnly, isAdminUser, loggedIn } from '../access'

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
