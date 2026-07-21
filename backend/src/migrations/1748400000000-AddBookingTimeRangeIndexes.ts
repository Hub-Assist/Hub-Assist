import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingTimeRangeIndexes1748400000000 implements MigrationInterface {
  name = 'AddBookingTimeRangeIndexes1748400000000';
  // Use CONCURRENTLY to avoid locking in production migrations.
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add composite index for time-range overlap queries and workspace-scoped lookups.
    // Reduces overlap check from seq scan O(n) to index scan O(log n) at 100k rows.
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "idx_bookings_workspaceid_starttime_endtime" 
      ON "bookings" ("workspaceId", "startTime", "endTime") 
      WHERE "status" != 'Cancelled'
    `);
    
    // Add index for the user booking list endpoint
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "idx_bookings_userid_createdat" 
      ON "bookings" ("userId", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_bookings_userid_createdat"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_bookings_workspaceid_starttime_endtime"`);
  }
}
