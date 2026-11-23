import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "recipes" ALTER COLUMN "chapter_id" DROP NOT NULL;
  ALTER TABLE "recipes" ALTER COLUMN "steps_text" DROP NOT NULL;
  ALTER TABLE "recipes" ADD COLUMN "cook_name" varchar;
  ALTER TABLE "users" ADD COLUMN "hide_name" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "recipes" ALTER COLUMN "chapter_id" SET NOT NULL;
  ALTER TABLE "recipes" ALTER COLUMN "steps_text" SET NOT NULL;
  ALTER TABLE "recipes" DROP COLUMN "cook_name";
  ALTER TABLE "users" DROP COLUMN "hide_name";`)
}
