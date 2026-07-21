import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `profilePictureUrls` JSONB column to the `users` table and
 * migrates any existing single-URL `profilePicture` values into the new
 * JSONB format.
 *
 * Migration strategy:
 *  1. Add the nullable `profilePictureUrls` JSONB column.
 *  2. For every row that already has a `profilePicture` URL, populate
 *     `profilePictureUrls` with the existing URL placed in all three
 *     variant slots (thumbnail, avatar, full).  This is a safe fallback –
 *     the next time the user uploads a new picture the proper Cloudinary
 *     transformation URLs will replace these values.
 *  3. The old `profilePicture` column is intentionally kept so that any
 *     existing API consumers that read it continue to work unchanged.
 *
 * Rollback: drops the `profilePictureUrls` column (the old column is untouched).
 */
export class AddProfilePictureUrls1748600000000 implements MigrationInterface {
  name = 'AddProfilePictureUrls1748600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new JSONB column
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "profilePictureUrls" jsonb
    `);

    // 2. Migrate existing single-URL data into the JSONB format.
    //    We use the existing URL for all three variants as a safe placeholder.
    await queryRunner.query(`
      UPDATE "users"
      SET "profilePictureUrls" = jsonb_build_object(
        'thumbnail', "profilePicture",
        'avatar',    "profilePicture",
        'full',      "profilePicture"
      )
      WHERE "profilePicture" IS NOT NULL
        AND "profilePictureUrls" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "profilePictureUrls"
    `);
  }
}
