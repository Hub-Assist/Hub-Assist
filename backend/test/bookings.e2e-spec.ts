import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnection, Connection } from 'typeorm';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/users/user.entity';
import { Workspace } from '../src/workspaces/workspace.entity';
import { WorkspaceType, WorkspaceAvailability } from '../src/workspaces/workspace.entity';
import { Booking } from '../src/bookings/booking.entity';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// Mock StellarService to avoid real blockchain calls
const mockStellarService = {
  verifyTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
};

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let authTokenAdmin: string;
  let authTokenMember: string;
  let testWorkspaceId: string;
  let adminUser: User;
  let memberUser: User;

  beforeAll(async () => {
    // Set test database URL from env
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) {
      throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for e2e tests');
    }
    process.env.DATABASE_URL = testDbUrl;
    process.env.NODE_ENV = 'test';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    connection = getConnection();

    // Create test data
    const userRepo = connection.getRepository(User);
    const workspaceRepo = connection.getRepository(Workspace);

     // Create admin user
     adminUser = userRepo.create({
       email: 'admin@test.com',
       passwordHash: await bcrypt.hash('adminpass', 10),
       role: UserRole.ADMIN,
     });
     await userRepo.save(adminUser);

     // Create member user
     memberUser = userRepo.create({
       email: 'member@test.com',
       passwordHash: await bcrypt.hash('memberpass', 10),
       role: UserRole.MEMBER,
     });
     await userRepo.save(memberUser);

     // Create workspace
     const workspace = workspaceRepo.create({
       name: 'Test Workspace',
       type: WorkspaceType.HOT_DESK,
       capacity: 10,
       pricePerHour: 50,
       availability: WorkspaceAvailability.AVAILABLE,
     });
    await workspaceRepo.save(workspace);
    testWorkspaceId = workspace.id;

    // Generate JWT tokens manually
    const jwtService = module.get(JwtService);
    authTokenAdmin = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });
    authTokenMember = jwtService.sign({
      sub: memberUser.id,
      email: memberUser.email,
      role: memberUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
    const conn = getConnection();
    await conn.dropDatabase();
    await conn.close();
  });

  beforeEach(async () => {
    // Clean bookings table before each test
    const bookingRepo = connection.getRepository(Booking);
    await bookingRepo.delete({});
  });

  // Helper function to create a booking via HTTP
  const createBooking = (token: string, data: any) => {
    return request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(data);
  };

  describe('POST /api/bookings', () => {
    it('should create a booking for authenticated user (201)', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString(); // tomorrow
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();   // day after

      const response = await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
      }).expect(201);

      expect(response.body).toMatchObject({
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
        userId: expect.any(String),
        status: 'Pending',
        id: expect.any(String),
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      await request(app.getHttpServer())
        .post('/api/bookings')
        .send({
          workspaceId: testWorkspaceId,
          startTime,
          endTime,
          totalAmount: 100,
        })
        .expect(401);
    });

    it('should return 404 for invalid workspace ID', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      await createBooking(authTokenMember, {
        workspaceId: '00000000-0000-0000-0000-000000000000',
        startTime,
        endTime,
        totalAmount: 100,
      }).expect(404);
    });

    it('should return 409 for overlapping booking', async () => {
      const startTime1 = new Date(Date.now() + 86400000 * 2).toISOString();
      const endTime1 = new Date(Date.now() + 86400000 * 3).toISOString();

      // Create a confirmed booking that overlaps
      const createRes = await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime: startTime1,
        endTime: endTime1,
        totalAmount: 100,
        stellarTxHash: 'test-tx-hash-1',
      }).expect(201);

      const bookingId = createRes.body.id;

       // Confirm the booking (admin only)
       await request(app.getHttpServer())
         .patch(`/api/bookings/${bookingId}/confirm`)
         .set('Authorization', `Bearer ${authTokenAdmin}`)
         .expect(200);

      // Attempt to create another booking with overlapping times (same day)
      const startTime2 = new Date(Date.now() + 86400000 * 2).toISOString();
      const endTime2 = new Date(Date.now() + 86400000 * 3).toISOString();

      await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime: startTime2,
        endTime: endTime2,
        totalAmount: 150,
      }).expect(409);
    });
  });

  describe('GET /api/bookings', () => {
    it('should return only member\'s own bookings', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
      }).expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/bookings')
        .set('Authorization', `Bearer ${authTokenMember}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((booking: any) => {
        expect(booking.userId).toBe(memberUser.id);
      });
    });

    it('should return all bookings for admin', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
      }).expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/bookings')
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const userIds = response.body.map((b: any) => b.userId);
      expect(userIds).toContain(memberUser.id);
    });
  });

  describe('PATCH /api/bookings/:id/confirm', () => {
    it('should allow admin to confirm a booking (200)', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      const createRes = await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
        stellarTxHash: 'test-tx-hash-confirm',
      }).expect(201);

      const bookingId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .expect(200);
      expect(getRes.body.status).toBe('Confirmed');
    });

    it('should return 403 for non-admin attempting to confirm', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      const createRes = await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
        stellarTxHash: 'test-tx-hash-confirm2',
      }).expect(201);

      const bookingId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${authTokenMember}`)
        .expect(403);
    });
  });

  describe('PATCH /api/bookings/:id/cancel', () => {
    it('should allow owner to cancel booking (200)', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      const createRes = await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
      }).expect(201);

      const bookingId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${authTokenMember}`)
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${authTokenMember}`)
        .expect(200);
      expect(getRes.body.status).toBe('Cancelled');
    });

    it('should return 403 for other user attempting to cancel', async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 86400000 * 2).toISOString();

      const createRes = await createBooking(authTokenMember, {
        workspaceId: testWorkspaceId,
        startTime,
        endTime,
        totalAmount: 100,
      }).expect(201);

      const bookingId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${authTokenAdmin}`)
        .expect(403);
    });
  });
});
