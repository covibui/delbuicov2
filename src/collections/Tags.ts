import type { CollectionConfig } from 'payload'
import { adminOnly, anyone, loggedIn } from '../access'
import { slugify } from '../lib/ingredients'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Tag', plural: 'Tags' },
  admin: { useAsTitle: 'name', description: 'Cuisine, occasion, “easy”, etc.' },
  defaultSort: 'name',
  access: { read: anyone, create: loggedIn, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: {
        beforeValidate: [({ value, data }) => value || (data?.name ? slugify(data.name) : value)],
      },
    },
  ],
}
