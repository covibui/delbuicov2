import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Chapters } from './collections/Chapters'
import { Tags } from './collections/Tags'
import { Recipes } from './collections/Recipes'
import { importOldSite } from './lib/importOldSite'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · DelBuiCo Cookbook' },
  },
  collections: [Recipes, Chapters, Tags, Media, Users],
  endpoints: [
    {
      // One-time import of the old site's recipes. Admin only; safe to repeat.
      path: '/import-old-site',
      method: 'post',
      handler: async (req) => {
        if ((req.user as { role?: string } | null)?.role !== 'admin') {
          return Response.json({ error: 'Only the admin can do this.' }, { status: 403 })
        }
        try {
          const result = await importOldSite(req.payload, { adminUserId: req.user!.id as number })
          return Response.json({ result })
        } catch (err) {
          req.payload.logger.error({ err, msg: 'import failed' })
          return Response.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 })
        }
      },
    },
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || '' },
  }),
  // Without RESEND_API_KEY, emails are printed to the server log instead of sent.
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
        defaultFromName: 'DelBuiCo Cookbook',
      })
    : undefined,
  sharp,
  plugins: [
    // Photos go to Vercel Blob in production; local disk when the token is missing.
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
})
