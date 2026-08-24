import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/user.entity';
import { Workspace, WorkspaceType, WorkspaceAvailability } from '../src/workspaces/workspace.entity';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// Mock StellarService to avoid real blockchain calls
const mockStellarService = {
  verifyTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
};

describe('Workspaces (e2e)', () => {
  let app: INestApplication;
  let connection: DataSource;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) {
      throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for e2e tests');
    }
    process.env.DATABASE_URL = testDbUrl;
    process.env.NODE_ENV = 'test';
    delete process.env.REDIS_URL;

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    const { TransformInterceptor } = await import('../src/common/interceptors/transform.interceptor');
    // LoggingInterceptor is already registered globally via APP_INTERCEPTOR in
    // AppModule (with its LoggerService dependency injected) — only
    // TransformInterceptor needs to be added manually here.
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    connection = module.get(DataSource);
    jwtService = module.get(JwtService);

    const userRepo = connection.getRepository(User);
    const member = userRepo.create({
      email: 'workspaces-member@test.com',
      passwordHash: await bcrypt.hash('pass', 10),
      role: UserRole.MEMBER,
    });
    await userRepo.save(member);
    authToken = jwtService.sign({ sub: member.id, email: member.email, role: member.role });
  });

  afterAll(async () => {
    // Drop the database while the DataSource is still connected — app.close()
    // tears down the DataSource, so it must run first.
    await connection.dropDatabase();
    await app.close();
  });

  // ── POST /api/v1/workspaces ───────────────────────────────────────────────────

  describe('POST /api/v1/workspaces', () => {
    const payload = {
      name: 'Hot Desk A',
      type: WorkspaceType.HOT_DESK,
      capacity: 5,
      pricePerHour: 10,
      availability: WorkspaceAvailability.AVAILABLE,
    };

    it('201 – authenticated user creates workspace', () =>
      request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload)
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toMatchObject({ name: payload.name, type: payload.type });
        }));

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).post('/api/v1/workspaces').send(payload).expect(401));
  });

  // ── GET /api/v1/workspaces ────────────────────────────────────────────────────

  describe('GET /api/v1/workspaces', () => {
    beforeEach(async () => {
      const workspaceRepo = connection.getRepository(Workspace);
      await workspaceRepo.save(
        workspaceRepo.create({
          name: 'Listed Workspace',
          type: WorkspaceType.HOT_DESK,
          capacity: 5,
          pricePerHour: 10,
          availability: WorkspaceAvailability.AVAILABLE,
        }),
      );
    });

    // Neither route below carries @Public(), so the global JwtAuthGuard
    // requires a valid Bearer token even though these are read-only lookups.
    it('200 – returns paginated list', () =>
      request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.data).toBeInstanceOf(Array);
          expect(res.body.data.total).toBeDefined();
        }));

    it('200 – supports page and limit query params', () =>
      request(app.getHttpServer())
        .get('/api/v1/workspaces?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200));

    it('200 – supports type filter', () =>
      request(app.getHttpServer())
        .get(`/api/v1/workspaces?type=${WorkspaceType.HOT_DESK}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200));
  });

  // ── GET /api/v1/workspaces/:id ────────────────────────────────────────────────

  describe('GET /api/v1/workspaces/:id', () => {
    it('200 – returns workspace details', async () => {
      const workspaceRepo = connection.getRepository(Workspace);
      const workspace = await workspaceRepo.save(
        workspaceRepo.create({
          name: 'Detail Workspace',
          type: WorkspaceType.HOT_DESK,
          capacity: 5,
          pricePerHour: 10,
          availability: WorkspaceAvailability.AVAILABLE,
        }),
      );

      return request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(workspace.id);
        });
    });

    it('404 – unknown id returns not found', () =>
      request(app.getHttpServer())
        .get('/api/v1/workspaces/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404));
  });

  // ── PATCH /api/v1/workspaces/:id ──────────────────────────────────────────────

  describe('PATCH /api/v1/workspaces/:id', () => {
    let workspaceId: string;

    beforeEach(async () => {
      const workspaceRepo = connection.getRepository(Workspace);
      const workspace = await workspaceRepo.save(
        workspaceRepo.create({
          name: 'Patchable Workspace',
          type: WorkspaceType.HOT_DESK,
          capacity: 5,
          pricePerHour: 10,
          availability: WorkspaceAvailability.AVAILABLE,
        }),
      );
      workspaceId = workspace.id;
    });

    it('200 – authenticated user updates workspace', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Desk' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.name).toBe('Updated Desk');
        }));

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .send({ name: 'Updated Desk' })
        .expect(401));
  });

  // ── DELETE /api/v1/workspaces/:id ─────────────────────────────────────────────

  describe('DELETE /api/v1/workspaces/:id', () => {
    it('200 – authenticated user soft-deletes workspace', async () => {
      const workspaceRepo = connection.getRepository(Workspace);
      const workspace = await workspaceRepo.save(
        workspaceRepo.create({
          name: 'Deletable Workspace',
          type: WorkspaceType.HOT_DESK,
          capacity: 5,
          pricePerHour: 10,
          availability: WorkspaceAvailability.AVAILABLE,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const found = await workspaceRepo.findOne({ where: { id: workspace.id } });
      expect(found).toBeNull();
    });
  });
});
