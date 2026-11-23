# The DelBuiCo Cookbook

The family cookbook. Anyone can read it; family members log in to add and edit recipes.

**Stack:** Payload CMS 3 + Next.js · Neon Postgres · Vercel Blob (photos) · Vercel Hobby. All free tiers. No email service.

## What's where

| Page | What it does |
|---|---|
| `/` | Home: newest recipes, chapter grid |
| `/chapters`, `/chapters/[slug]` | Table of contents; recipes A–Z, numbered like a cookbook (*IX · 4*) |
| `/recipes/[slug]` | Recipe page with ×½ / ×2 / ×3 scaling and print view |
| `/search` | Search titles + ingredients; filter by chapter, cook, tag |
| `/add` | **Quick Add**: paste a link, paste text, or type. Phone-friendly. `/add?edit=ID` edits. |
| `/login`, `/account` | Family login; change your name and password; your recipes |
| `/admin` | Payload admin: invite people, manage chapters and tags, fix anything |

**Rules:** recipes publish on save. Members edit/delete only their own recipes; the admin can edit everything. The first account ever created becomes admin.

## Deploy (one time, ~20 minutes)

1. **Vercel → Add New → Project →** import `covibui/delbuicov2`. Framework: Next.js (the build command comes from `vercel.json`).
2. **Storage tab → Create Database → Neon** (free). This adds `DATABASE_URL`.
3. **Storage tab → Create → Blob** (free, choose **public** access). This adds `BLOB_READ_WRITE_TOKEN`.
4. **Settings → Environment Variables:** add `PAYLOAD_SECRET` (random string, e.g. `openssl rand -hex 32`).
5. **Deploy.** The build runs database migrations first, then builds.

### Import the old recipes (once)

1. Go to `/admin` and create the first account. It automatically becomes the admin.
2. Go to `/account` and press **Import old recipes** (shown to the admin while the cookbook is empty).

This creates all 24 chapters (with cover photos), the tags, the 59 recipes, and accounts for the
original authors so their recipes keep their names. Brianna's recipes are credited to the admin
running the import. Safe to press twice. (`npm run seed` does the same from the command line.)

### Add the family

`/admin` → **Family**:
- **Original authors** (Max, Miche, Xander, Alex) already exist with placeholder emails like `miche@invite.pending`.
  Open one, put in their real email, type a temporary password in the password field, and save.
- **Someone new:** **Create new** → name, email, temporary password → save.

Give them the email and password. They can change the password on their **Account** page.
If someone forgets their password, open their entry in the admin and type a new one.

## Local development

```bash
cp .env.example .env     # point DATABASE_URL at a local Postgres
npm install
npm run dev              # http://localhost:3000 (schema is created automatically in dev)
npm run seed             # optional: load the old recipes
```

When you change a collection's fields: `npm run payload migrate:create <name>` and commit the new file in `src/migrations/`.

## How recipe text is handled

Ingredients, steps and equipment are plain text boxes, one item per line. This replaces the old
one-row-per-ingredient form. On save, each ingredient line is parsed into quantity / unit / item
(`src/lib/ingredients.ts`) so the scaler works. Anything it can't read is kept as written.
Substitutes go after a `|`: `1 cup sugar | or honey`.

Link import reads the schema.org Recipe data most recipe sites publish (`src/lib/recipeImport.ts`).
Sites that block it, or don't publish it, fall back to "Paste text".
