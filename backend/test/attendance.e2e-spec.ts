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
import { AttendanceController } from '../src/attendance/attendance.controller';
import { AttendanceService } from '../src/attendance/attendance.service';
import { AttendanceAutoCompleteService } from '../src/attendance/attendance-auto-complete.service';
import { Attendance, AttendanceAction } from '../src/attendance/attendance.entity';
import { EmailService } from '../src/email/email.service';
import { UsersService } from '../src/users/users.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { validationSchema } from '../src/config/validation.schema';
import { User, UserRole } from '../src/users/user.entity';

const JWT_SECRET = process.env.JWT_SECRET || 'hubassist-secret';
const MAX_SESSION_HOURS = 1;

// Sessions auto-complete after MAX_SESSION_HOURS of no clock-out. Email
// delivery is unrelated to this flow's correctness, so EmailService is
// stubbed — everything else (HTTP routing, guards, real Postgres-backed
// state transitions) runs for real.
const mockEmailService = {
  sendAttendanceAutoCompleted: jest.fn().mockResolvedValue(undefined),
};

describe('Attendance (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let attendanceRepo: Repository<Attendance>;
  let autoCompleteService: AttendanceAutoCompleteService;
  let memberUser: User;
  let adminUser: User;
  let memberToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for e2e tests');
    }
    process.env.MAX_SESSION_HOURS = String(MAX_SESSION_HOURS);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
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
        TypeOrmModule.forFeature([User, Attendance]),
      ],
      controllers: [AttendanceController],
      providers: [
        AttendanceService,
        AttendanceAutoCompleteService,
        JwtStrategy,
        RolesGuard,
        TokenBlacklistService,
        { provide: EmailService, useValue: mockEmailService },
        { provide: UsersService, useValue: {} }, // injected but unused by the auto-complete flow
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    jwtService = module.get(JwtService);
    userRepo = module.get(getRepositoryToken(User));
    attendanceRepo = module.get(getRepositoryToken(Attendance));
    autoCompleteService = module.get(AttendanceAutoCompleteService);

    memberUser = await userRepo.save(
      userRepo.create({
        email: `attendance-e2e-member-${crypto.randomUUID()}@test.com`,
        passwordHash: await bcrypt.hash('memberpass', 4),
        role: UserRole.MEMBER,
      }),
    );
    adminUser = await userRepo.save(
      userRepo.create({
        email: `attendance-e2e-admin-${crypto.randomUUID()}@test.com`,
        passwordHash: await bcrypt.hash('adminpass', 4),
        role: UserRole.ADMIN,
      }),
    );
    memberToken = jwtService.sign({
      sub: memberUser.id,
      email: memberUser.email,
      role: memberUser.role,
    });
    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await attendanceRepo.createQueryBuilder().delete().from(Attendance).execute();
    mockEmailService.sendAttendanceAutoCompleted.mockClear();
  });

  // ── Clock-in / clock-out HTTP flow ─────────────────────────────────────────

  describe('POST /api/v1/attendance/clock-in', () => {
    it('201 – records a clock-in for the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.message).toBe('Clocked in successfully');
    });

    it('400 – rejects a second clock-in while a session is already open', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(400);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).post('/api/v1/attendance/clock-in').send({}).expect(401));
  });

  describe('POST /api/v1/attendance/clock-out', () => {
    it('201 – records a clock-out and returns the session duration', async () => {
      const clockInRes = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      expect(res.body.data.sessionId).toBe(clockInRes.body.data.sessionId);
      expect(typeof res.body.data.sessionDuration).toBe('number');
      expect(res.body.data.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('400 – rejects clock-out with no active session', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(400);
    });

    it('400 – rejects a second clock-out for the same session', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(400);
    });

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).post('/api/v1/attendance/clock-out').send({}).expect(401));
  });

  describe('GET /api/v1/attendance/my', () => {
    it("200 – returns the authenticated user's own history, most recent first", async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/attendance/my')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.data[0].action).toBe('clock_out');
      expect(res.body.data.data[1].action).toBe('clock_in');
    });
  });

  describe('GET /api/v1/attendance/all (admin only)', () => {
    it('200 – admin can list all attendance records', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/attendance/all?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
    });

    it('403 – a non-admin member is rejected', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/attendance/all')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  // ── Auto-complete (abandoned session cleanup) ──────────────────────────────

  describe('attendance auto-complete (clock-in → abandoned → auto-complete)', () => {
    it('auto-completes a session left open past MAX_SESSION_HOURS and notifies the user', async () => {
      const clockInRes = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);
      const sessionId = clockInRes.body.data.sessionId;

      // Backdate the clock-in beyond the configured session timeout so it is
      // picked up as "abandoned" by the auto-complete sweep.
      await attendanceRepo.update(
        { userId: memberUser.id, sessionId, action: AttendanceAction.CLOCK_IN },
        { timestamp: new Date(Date.now() - (MAX_SESSION_HOURS * 60 * 60 * 1000 + 60_000)) },
      );

      await autoCompleteService.autoCompleteAbandonedSessions();

      const records = await attendanceRepo.find({ where: { userId: memberUser.id, sessionId } });
      const clockIn = records.find((r) => r.action === AttendanceAction.CLOCK_IN)!;
      const clockOut = records.find((r) => r.action === AttendanceAction.CLOCK_OUT)!;

      expect(clockIn.autoCompleted).toBe(true);
      expect(clockOut).toBeDefined();
      expect(clockOut.autoCompleted).toBe(true);
      expect(clockOut.autoCompletedReason).toMatch(/auto-completed/i);
      expect(mockEmailService.sendAttendanceAutoCompleted).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendAttendanceAutoCompleted).toHaveBeenCalledWith(
        memberUser.email,
        expect.objectContaining({ maxSessionHours: MAX_SESSION_HOURS }),
      );

      // Reflected via the real HTTP history endpoint too.
      const historyRes = await request(app.getHttpServer())
        .get('/api/v1/attendance/my')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      const autoCompletedRecord = historyRes.body.data.data.find(
        (r: any) => r.sessionId === sessionId && r.action === 'clock_out',
      );
      expect(autoCompletedRecord.autoCompleted).toBe(true);
    });

    it('does not auto-complete a session that is still within MAX_SESSION_HOURS', async () => {
      const clockInRes = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);
      const sessionId = clockInRes.body.data.sessionId;

      await autoCompleteService.autoCompleteAbandonedSessions();

      const records = await attendanceRepo.find({ where: { userId: memberUser.id, sessionId } });
      expect(records).toHaveLength(1); // still just the open clock-in
      expect(records[0].autoCompleted).toBe(false);
      expect(mockEmailService.sendAttendanceAutoCompleted).not.toHaveBeenCalled();
    });

    it('is idempotent — running the sweep twice does not double-complete a session', async () => {
      const clockInRes = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .expect(201);
      const sessionId = clockInRes.body.data.sessionId;

      await attendanceRepo.update(
        { userId: memberUser.id, sessionId, action: AttendanceAction.CLOCK_IN },
        { timestamp: new Date(Date.now() - (MAX_SESSION_HOURS * 60 * 60 * 1000 + 60_000)) },
      );

      await autoCompleteService.autoCompleteAbandonedSessions();
      await autoCompleteService.autoCompleteAbandonedSessions();

      const records = await attendanceRepo.find({ where: { userId: memberUser.id, sessionId } });
      expect(records.filter((r) => r.action === AttendanceAction.CLOCK_OUT)).toHaveLength(1);
      expect(mockEmailService.sendAttendanceAutoCompleted).toHaveBeenCalledTimes(1);
    });
  });
});
