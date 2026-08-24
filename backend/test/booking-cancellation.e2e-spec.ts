import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BookingsModule } from '../src/bookings/bookings.module';
import { AuditLogModule } from '../src/audit/audit-log.module';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { User, UserRole } from '../src/users/user.entity';
import {
  Workspace,
  WorkspaceType,
  WorkspaceAvailability,
} from '../src/workspaces/workspace.entity';
import { Amenity } from '../src/workspaces/amenity.entity';
import { MaintenanceWindow } from '../src/workspaces/maintenance-window.entity';
import { Booking } from '../src/bookings/booking.entity';
import { CancellationPolicy } from '../src/bookings/cancellation-policy.entity';

const JWT_SECRET = process.env.JWT_SECRET || 'hubassist-secret';

// Real blockchain calls are out of scope for this flow — mocked exactly like
// the existing bookings e2e suite.
const mockStellarService = {
  verifyTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
};

describe('Booking cancellation & refund policy (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let workspaceRepo: Repository<Workspace>;
  let bookingRepo: Repository<Booking>;
  let policyRepo: Repository<CancellationPolicy>;
  let memberUser: User;
  let memberToken: string;

  const createWorkspace = (type: WorkspaceType) =>
    workspaceRepo.save(
      workspaceRepo.create({
        name: `Cancellation Test Workspace (${type})`,
        type,
        capacity: 10,
        pricePerHour: 50,
        availability: WorkspaceAvailability.AVAILABLE,
      }),
    );

  // Note: totalAmount is always computed server-side by the PricingEngine
  // from workspace.pricePerHour — any client-supplied value is ignored, so
  // callers read the real charged amount back from the create response.
  const createBooking = (workspaceId: string, startTime: Date) =>
    request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Idempotency-Key', crypto.randomUUID())
      .send({
        workspaceId,
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + 60 * 60 * 1000).toISOString(),
      });

  beforeAll(async () => {
    const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for e2e tests');
    }

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        NestCacheModule.register({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User, Amenity, MaintenanceWindow]),
        AuditLogModule.forRoot(),
        BookingsModule,
      ],
      providers: [
        JwtStrategy,
        TokenBlacklistService,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    jwtService = module.get(JwtService);
    userRepo = module.get(getRepositoryToken(User));
    workspaceRepo = module.get(getRepositoryToken(Workspace));
    bookingRepo = module.get(getRepositoryToken(Booking));
    policyRepo = module.get(getRepositoryToken(CancellationPolicy));

    memberUser = await userRepo.save(
      userRepo.create({
        email: `cancel-e2e-member-${crypto.randomUUID()}@test.com`,
        passwordHash: await bcrypt.hash('memberpass', 4),
        role: UserRole.MEMBER,
      }),
    );
    memberToken = jwtService.sign({
      sub: memberUser.id,
      email: memberUser.email,
      role: memberUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await bookingRepo.createQueryBuilder().delete().from(Booking).execute();
  });

  // ── Default policy fallback (no CancellationPolicy row configured) ────────

  describe('cancellation with no configured policy (default: full refund ≥ 24h, else none)', () => {
    it('200 – full refund when cancelled more than 24h before start', async () => {
      const workspace = await createWorkspace(WorkspaceType.HOT_DESK);
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h out
      const createRes = await createBooking(workspace.id, startTime).expect(201);
      const bookingId = createRes.body.data.id;
      const totalAmount = Number(createRes.body.data.totalAmount);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('Cancelled');
      expect(Number(res.body.data.refundAmount)).toBe(totalAmount);
    });

    it('200 – no refund when cancelled inside the 24h window', async () => {
      const workspace = await createWorkspace(WorkspaceType.HOT_DESK);
      const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h out
      const createRes = await createBooking(workspace.id, startTime).expect(201);
      const bookingId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('Cancelled');
      expect(Number(res.body.data.refundAmount)).toBe(0);
    });
  });

  // ── Configured policy with a partial-refund bracket ────────────────────────

  describe('cancellation with a configured policy (full=24h, partial=50%@4h)', () => {
    let meetingRoomWorkspace: Workspace;

    beforeAll(async () => {
      meetingRoomWorkspace = await createWorkspace(WorkspaceType.MEETING_ROOM);
      await policyRepo.save(
        policyRepo.create({
          workspaceType: WorkspaceType.MEETING_ROOM,
          fullRefundHoursBefore: 24,
          partialRefundPercent: 50,
          partialRefundHoursBefore: 4,
        }),
      );
    });

    afterAll(async () => {
      await policyRepo.delete({ workspaceType: WorkspaceType.MEETING_ROOM });
    });

    it('200 – full refund outside the full-refund threshold', async () => {
      const startTime = new Date(Date.now() + 30 * 60 * 60 * 1000); // 30h out
      const createRes = await createBooking(meetingRoomWorkspace.id, startTime).expect(201);
      const totalAmount = Number(createRes.body.data.totalAmount);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${createRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Number(res.body.data.refundAmount)).toBe(totalAmount);
    });

    it('200 – partial refund inside the partial-refund window', async () => {
      const startTime = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10h out — within 4h–24h band
      const createRes = await createBooking(meetingRoomWorkspace.id, startTime).expect(201);
      const totalAmount = Number(createRes.body.data.totalAmount);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${createRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Number(res.body.data.refundAmount)).toBe(Number((totalAmount * 0.5).toFixed(2)));
    });

    it('200 – no refund below the partial-refund threshold', async () => {
      const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1h out
      const createRes = await createBooking(meetingRoomWorkspace.id, startTime).expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${createRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Number(res.body.data.refundAmount)).toBe(0);
    });
  });

  // ── Authorization / edge cases ─────────────────────────────────────────────

  describe('authorization and edge cases', () => {
    it("403 – a different user cannot cancel someone else's booking", async () => {
      const otherUser = await userRepo.save(
        userRepo.create({
          email: `cancel-e2e-other-${crypto.randomUUID()}@test.com`,
          passwordHash: await bcrypt.hash('otherpass', 4),
          role: UserRole.MEMBER,
        }),
      );
      const otherToken = jwtService.sign({
        sub: otherUser.id,
        email: otherUser.email,
        role: otherUser.role,
      });

      const workspace = await createWorkspace(WorkspaceType.HOT_DESK);
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const createRes = await createBooking(workspace.id, startTime).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${createRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('401 – unauthenticated cancellation is rejected', async () => {
      const workspace = await createWorkspace(WorkspaceType.HOT_DESK);
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const createRes = await createBooking(workspace.id, startTime).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${createRes.body.data.id}/cancel`)
        .expect(401);
    });

    it('cancelling an already-cancelled booking does not change the refund already recorded', async () => {
      const workspace = await createWorkspace(WorkspaceType.HOT_DESK);
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const createRes = await createBooking(workspace.id, startTime).expect(201);
      const bookingId = createRes.body.data.id;
      const totalAmount = Number(createRes.body.data.totalAmount);

      const first = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(Number(first.body.data.refundAmount)).toBe(totalAmount);

      const second = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(second.body.data.status).toBe('Cancelled');
      expect(Number(second.body.data.refundAmount)).toBe(totalAmount);
    });
  });
});
