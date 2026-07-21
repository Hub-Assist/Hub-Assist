import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1748358278000 implements MigrationInterface {
  name = 'InitialSchema1748358278000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'member', 'staff')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"               uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "firstName"        character varying,
        "lastName"         character varying,
        "email"            character varying NOT NULL,
        "passwordHash"     character varying NOT NULL,
        "role"             "public"."users_role_enum" NOT NULL DEFAULT 'member',
        "stellarPublicKey" character varying,
        "otp"              character varying,
        "otpExpiry"        TIMESTAMP,
        "isVerified"       boolean           NOT NULL DEFAULT false,
        "isActive"         boolean           NOT NULL DEFAULT true,
        "profilePicture"   character varying,
        "createdAt"        TIMESTAMP         NOT NULL DEFAULT now(),
        "deletedAt"        TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"        uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "token"     character varying NOT NULL,
        "userId"    uuid      NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "isRevoked" boolean   NOT NULL DEFAULT false,
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "webauthn_credentials" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "userId"       uuid              NOT NULL,
        "credentialId" character varying NOT NULL,
        "publicKey"    text              NOT NULL,
        "counter"      bigint            NOT NULL,
        "createdAt"    TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webauthn_credentials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webauthn_credentials_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."workspaces_type_enum" AS ENUM(
        'HotDesk', 'DedicatedDesk', 'PrivateOffice', 'MeetingRoom', 'Virtual', 'Hybrid'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."workspaces_availability_enum" AS ENUM('Available', 'Unavailable')
    `);
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id"           uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "name"         character varying NOT NULL,
        "type"         "public"."workspaces_type_enum" NOT NULL,
        "capacity"     integer           NOT NULL,
        "pricePerHour" numeric(10,2)     NOT NULL,
        "availability" "public"."workspaces_availability_enum" NOT NULL,
        "description"  character varying,
        "amenities"    text[]            NOT NULL DEFAULT '{}',
        "isActive"     boolean           NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP         NOT NULL DEFAULT now(),
        "deletedAt"    TIMESTAMP,
        CONSTRAINT "PK_workspaces" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."bookings_status_enum" AS ENUM(
        'Pending', 'Confirmed', 'Cancelled', 'Completed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id"            uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId"   uuid              NOT NULL,
        "userId"        uuid              NOT NULL,
        "startTime"     TIMESTAMP         NOT NULL,
        "endTime"       TIMESTAMP         NOT NULL,
        "status"        "public"."bookings_status_enum" NOT NULL DEFAULT 'Pending',
        "totalAmount"   numeric(10,2)     NOT NULL,
        "stellarTxHash" character varying,
        "createdAt"     TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_workspace" FOREIGN KEY ("workspaceId")
          REFERENCES "workspaces"("id"),
        CONSTRAINT "FK_bookings_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."attendance_action_enum" AS ENUM('clock_in', 'clock_out')
    `);
    await queryRunner.query(`
      CREATE TABLE "attendance" (
        "id"        uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "userId"    uuid      NOT NULL,
        "action"    "public"."attendance_action_enum" NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        "sessionId" uuid,
        "details"   jsonb,
        CONSTRAINT "PK_attendance" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attendance_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "newsletter_subscribers" (
        "id"                uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "email"             character varying NOT NULL,
        "confirmationToken" uuid              NOT NULL,
        "isConfirmed"       boolean           NOT NULL DEFAULT false,
        "unsubscribeToken"  uuid              NOT NULL,
        "ipAddress"         character varying,
        "subscribedAt"      TIMESTAMP         NOT NULL DEFAULT now(),
        "confirmedAt"       character varying,
        CONSTRAINT "UQ_newsletter_subscribers_email" UNIQUE ("email"),
        CONSTRAINT "PK_newsletter_subscribers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "contact_messages" (
        "id"        uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "fullName"  character varying NOT NULL,
        "email"     character varying NOT NULL,
        "subject"   character varying NOT NULL,
        "message"   text              NOT NULL,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_messages" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "contact_messages"`);
    await queryRunner.query(`DROP TABLE "newsletter_subscribers"`);
    await queryRunner.query(`DROP TABLE "attendance"`);
    await queryRunner.query(`DROP TYPE "public"."attendance_action_enum"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TYPE "public"."workspaces_availability_enum"`);
    await queryRunner.query(`DROP TYPE "public"."workspaces_type_enum"`);
    await queryRunner.query(`DROP TABLE "webauthn_credentials"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
