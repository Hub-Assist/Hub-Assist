import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReliabilityWebhookAuditSoftDelete1748500000000 implements MigrationInterface {
  name = 'ReliabilityWebhookAuditSoftDelete1748500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "outbox_events_status_enum" AS ENUM ('pending', 'sent', 'failed')`);
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "eventType" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_events_status_enum" NOT NULL DEFAULT 'pending',
        "retryCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "processedAt" TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_outbox_events_status_created_at" ON "outbox_events" ("status", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "webhook_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "url" character varying NOT NULL,
        "secretHash" character varying NOT NULL,
        "encryptedSecret" character varying NOT NULL,
        "eventTypes" text array NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE TYPE "webhook_deliveries_status_enum" AS ENUM ('pending', 'delivered', 'failed', 'dead')`);
    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "subscriptionId" uuid NOT NULL,
        "eventType" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "webhook_deliveries_status_enum" NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "nextRetryAt" TIMESTAMP NOT NULL,
        "responseCode" integer,
        "lastError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_webhook_deliveries_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_webhook_deliveries_status_next_retry_at" ON "webhook_deliveries" ("status", "nextRetryAt")`);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actorId" character varying,
        "actorRole" character varying,
        "eventType" character varying NOT NULL,
        "resourceType" character varying NOT NULL,
        "resourceId" character varying NOT NULL,
        "before" jsonb,
        "after" jsonb,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_resource_created_at" ON "audit_logs" ("resourceType", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_actor_created_at" ON "audit_logs" ("actorId", "createdAt")`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_prevent_audit_log_update"
      BEFORE UPDATE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_prevent_audit_log_delete"
      BEFORE DELETE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation()
    `);

    await queryRunner.query(`ALTER TABLE "bookings" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "deletedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "attendance" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_prevent_audit_log_delete" ON "audit_logs"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_prevent_audit_log_update" ON "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_log_mutation`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_actor_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_resource_created_at"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_webhook_deliveries_status_next_retry_at"`);
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(`DROP TYPE "webhook_deliveries_status_enum"`);
    await queryRunner.query(`DROP TABLE "webhook_subscriptions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_events_status_created_at"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP TYPE "outbox_events_status_enum"`);
  }
}
