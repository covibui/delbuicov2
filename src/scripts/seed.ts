/**
 * Command-line version of the one-time import (the admin button does the same thing).
 *
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run seed
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { importOldSite } from '../lib/importOldSite'

// Top-level await: `payload run` exits as soon as the module finishes loading.
try {
  const payload = await getPayload({ config })
  const r = await importOldSite(payload, {
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
  })
  payload.logger.info(`Done: ${JSON.stringify(r)}`)
  process.exit(0)
} catch (err) {
  console.error(err)
  process.exit(1)
}
