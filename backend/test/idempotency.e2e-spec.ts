/**
 * E2E tests for the idempotency key middleware.
 *
 * These tests spin up the full NestJS application (with an in-memory cache
 * store — no Redis required) and exercise POST /api/v1/bookings to verify
 * that duplicate requests with the same X-Idempotency-Key are safely
 * deduplicated without creating phantom bookings.
 *
 * Run with:
 *   npm run test:e2e -- --testPathPattern=idempotency
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnection } from 'typeorm';
import { User, UserRole } from '../src/users/user.entity';
import { Workspace, WorkspaceType, WorkspaceAvailability } from '../src/workspaces/workspace.entity';
import { Booking } from '../src/bookings/booking.entity';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const mockStellarService = {
  verifyTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
};

describe('Idempotency Middleware (e2e)', () => {
  let app: INestApplication;
  let memberToken: string;
  let memberUserId: string;
  let otherMemberToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) throw new Error('DATABASE_URL must be set for e2e tests');
    process.env.DATABASE_URL = testDbUrl;
    process.env.NODE_ENV = 'test';
    // Ensure no Redis is used so tests are self-contained
    delete process.env.REDIS_URL;

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    const { TransformInterceptor } = await import('../src/common/interceptors/transform.interceptor');
    const { LoggingInterceptor } = await import('../src/common/interceptors/logging.interceptor');
    app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
    await app.init();

    const connection = getConnection();
    const userRepo = connection.getRepository(User);
    const workspaceRepo = connection.getRepository(Workspace);

    const member = userRepo.create({
      email: 'idempotency-member@test.com',
      passwordHash: await bcrypt.hash('pass', 10),
      role: UserRole.MEMBER,
    });
    await userRepo.save(member);
    memberUserId = member.id;

    const otherMember = userRepo.create({
      email: 'idempotency-other@test.com',
      passwordHash: await bcrypt.hash('pass', 10),
      role: UserRole.MEMBER,
    });
    await userRepo.save(otherMember);

    const workspace = workspaceRepo.create({
      name: 'Idempotency Test Workspace',
      type: WorkspaceType.HOT_DESK,
      capacity: 10,
      pricePerHour: 50,
      availability: WorkspaceAvailability.AVAILABLE,
    });
    await workspaceRepo.save(workspace);
    workspaceId = workspace.id;

    const jwtService = module.get(JwtService);
    memberToken = jwtService.sign({ sub: member.id, email: member.email, role: member.role });
    otherMemberToken = jwtService.sign({ sub: otherMember.id, email: otherMember.email, role: otherMember.role });
  });

  afterAll(async () => {
    await app.close();
    const conn = getConnection();
    await conn.dropDatabase();
    await conn.close();
  });

  afterEach(async () => {
    const conn = getConnection();
    await conn.getRepository(Booking).delete({});
  });

  // ── Helper ───────────────────────────────────────────────────────────────

  function postBooking(token: string, idempotencyKey: string, body?: object) {
    const startTime = new Date(Date.now() + 86_400_000).toISOString();
    const endTime = new Date(Date.now() + 86_400_000 * 2).toISOString();

    return request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send(body ?? { workspaceId, startTime, endTime });
  }

  // ── Missing / malformed key ──────────────────────────────────────────────

  it('returns 422 when X-Idempotency-Key header is absent', async () => {
    const startTime = new Date(Date.now() + 86_400_000).toISOString();
    const endTime = new Date(Date.now() + 86_400_000 * 2).toISOString();

    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ workspaceId, startTime, endTime })
      .expect(422);
  });

  it('returns 422 when X-Idempotency-Key contains whitespace', async () => {
    await postBooking(memberToken, 'bad key with spaces').expect(422);
  });

  // ── First request succeeds ───────────────────────────────────────────────

  it('creates a booking on the first request (201)', async () => {
    const key = uuidv4();
    const res = await postBooking(memberToken, key).expect(201);
    expect(res.body.data).toMatchObject({ workspaceId, userId: memberUserId });
  });

  // ── Duplicate request is deduplicated ────────────────────────────────────

  it('returns the same response on a duplicate request without creating a second booking', async () => {
    const key = uuidv4();

    const first = await postBooking(memberToken, key).expect(201);
    const firstBookingId = first.body.data.id;

    // Second request with the same key — must replay the first response
    const second = await postBooking(memberToken, key);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(firstBookingId);

    // Verify only one booking exists in the database
    const conn = getConnection();
    const bookings = await conn.getRepository(Booking).find({ where: { userId: memberUserId } });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toBe(firstBookingId);
  });

  // ── Different key creates a new booking ─────────────────────────────────

  it('creates a new booking when a different idempotency key is used', async () => {
    const startA = new Date(Date.now() + 86_400_000).toISOString();
    const endA = new Date(Date.now() + 86_400_000 * 2).toISOString();
    const startB = new Date(Date.now() + 86_400_000 * 3).toISOString();
    const endB = new Date(Date.now() + 86_400_000 * 4).toISOString();

    const resA = await postBooking(memberToken, uuidv4(), { workspaceId, startTime: startA, endTime: endA }).expect(201);
    const resB = await postBooking(memberToken, uuidv4(), { workspaceId, startTime: startB, endTime: endB }).expect(201);

    expect(resA.body.data.id).not.toBe(resB.body.data.id);

    const conn = getConnection();
    const bookings = await conn.getRepository(Booking).find({ where: { userId: memberUserId } });
    expect(bookings).toHaveLength(2);
  });

  // ── Cross-user key isolation ─────────────────────────────────────────────

  it('does NOT replay a cached response when a different user sends the same key', async () => {
    const sharedKey = uuidv4();

    // Member 1 creates a booking
    const first = await postBooking(memberToken, sharedKey).expect(201);
    const firstBookingId = first.body.data.id;

    // Member 2 uses the same key — should create a NEW booking, not replay member 1's
    const startTime = new Date(Date.now() + 86_400_000 * 3).toISOString();
    const endTime = new Date(Date.now() + 86_400_000 * 4).toISOString();

    const second = await postBooking(otherMemberToken, sharedKey, { workspaceId, startTime, endTime }).expect(201);

    expect(second.body.data.id).not.toBe(firstBookingId);
  });
});
