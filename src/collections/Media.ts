import type { CollectionConfig } from 'payload'
import { adminOrOwner, anyone, loggedIn } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Photo', plural: 'Photos' },
  access: {
    read: anyone,
    create: loggedIn,
    update: adminOrOwner('uploadedBy'),
    delete: adminOrOwner('uploadedBy'),
  },
  fields: [
    { name: 'alt', type: 'text', label: 'Description (for screen readers)' },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, position: 'sidebar' },
      hooks: {
        beforeChange: [({ req, operation, value }) => (operation === 'create' && req.user ? req.user.id : value)],
      },
    },
    // The Vercel Blob plugin adds this column when BLOB_READ_WRITE_TOKEN is set.
    // Declare it ourselves otherwise, so the database schema is the same with or
    // without the token (keeps migrations consistent between local and production).
    ...(process.env.BLOB_READ_WRITE_TOKEN
      ? []
      : [{ name: '_objectKey', type: 'text' as const, admin: { hidden: true } }]),
  ],
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    imageSizes: [
      { name: 'thumb', width: 400, height: 500, position: 'centre' },
      { name: 'card', width: 800, height: 1000, position: 'centre' },
      { name: 'large', width: 1600, withoutEnlargement: true },
    ],
    adminThumbnail: 'thumb',
  },
}
