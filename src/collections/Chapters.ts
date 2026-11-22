import type { CollectionConfig } from 'payload'
import { adminOnly, anyone } from '../access'
import { slugify } from '../lib/ingredients'

export const Chapters: CollectionConfig = {
  slug: 'chapters',
  labels: { singular: 'Chapter', plural: 'Chapters' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['order', 'title', 'slug'],
    description: 'The sections of the cookbook. Only the admin can change these.',
  },
  defaultSort: 'order',
  access: { read: anyone, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'order',
      type: 'number',
      required: true,
      admin: { description: 'Position in the table of contents (1 = first). Shown as a Roman numeral.' },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Part of the web address. Filled in automatically.' },
      hooks: {
        beforeValidate: [({ value, data }) => value || (data?.title ? slugify(data.title) : value)],
      },
    },
    { name: 'blurb', type: 'textarea', admin: { description: 'One line under the chapter title.' } },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'recipes', type: 'join', collection: 'recipes', on: 'chapter', defaultSort: 'title' },
  ],
}
