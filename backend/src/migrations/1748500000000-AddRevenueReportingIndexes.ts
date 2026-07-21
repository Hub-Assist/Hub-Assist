import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds indexes that support the admin revenue reporting queries:
 *
 *  - idx_bookings_starttime_status_amount  – covers the date-range + status filter
 *    used by GET /admin/reports/revenue.  The partial index excludes Cancelled
 *    bookings to keep it lean.
 *
 *  - idx_bookings_starttime_workspaceid    – supports the JOIN to workspaces when
 *    filtering by workspaceType.
 *
 * Both indexes use CONCURRENTLY to avoid locking in production.
 */
export class AddRevenueReportingIndexes1748500000000 implements MigrationInterface {
  name = 'AddRevenueReportingIndexes1748500000000';
  transaction = false; // required for CONCURRENTLY

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Covers: WHERE startTime BETWEEN :start AND :end AND status = :status
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bookings_starttime_status"
      ON "bookings" ("startTime", "status")
      WHERE "status" != 'Cancelled'
    `);

    // Covers: WHERE startTime BETWEEN :start AND :end (workspace join path)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_bookings_starttime_workspaceid"
      ON "bookings" ("startTime", "workspaceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_bookings_starttime_workspaceid"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_bookings_starttime_status"`,
    );
  }
}
