import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspacesModule } from '../src/workspaces/workspaces.module';
import { Workspace, WorkspaceType, WorkspaceAvailability } from '../src/workspaces/workspace.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';

const JWT_SECRET = 'hubassist-secret';

const mockWorkspace = {
  id: 'ws-uuid-1',
  name: 'Hot Desk A',
  type: WorkspaceType.HOT_DESK,
  capacity: 5,
  pricePerHour: 10,
  availability: WorkspaceAvailability.AVAILABLE,
  description: null,
  amenities: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockRepo = {
  create: jest.fn().mockReturnValue(mockWorkspace),
  save: jest.fn().mockResolvedValue(mockWorkspace),
  findOne: jest.fn().mockResolvedValue(mockWorkspace),
  update: jest.fn().mockResolvedValue({}),
  softDelete: jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockWorkspace], 1]),
  }),
};

describe('Workspaces (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const makeToken = (role: string) =>
    jwtService.sign({ sub: 'user-id', email: 'user@test.com', role });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        WorkspacesModule,
      ],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideProvider(getRepositoryToken(Workspace))
      .useValue(mockRepo)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = module.get(JwtService);
  });

  afterAll(() => app.close());

  // ── POST /api/workspaces ───────────────────────────────────────────────────

  describe('POST /api/workspaces', () => {
    const payload = {
      name: 'Hot Desk A',
      type: WorkspaceType.HOT_DESK,
      capacity: 5,
      pricePerHour: 10,
      availability: WorkspaceAvailability.AVAILABLE,
    };

    it('201 – authenticated user creates workspace', () =>
      request(app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .send(payload)
        .expect(201));

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer()).post('/api/workspaces').send(payload).expect(401));
  });

  // ── GET /api/workspaces ────────────────────────────────────────────────────

  describe('GET /api/workspaces', () => {
    it('200 – returns paginated list', () =>
      request(app.getHttpServer())
        .get('/api/workspaces')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.total).toBeDefined();
        }));

    it('200 – supports page and limit query params', () =>
      request(app.getHttpServer())
        .get('/api/workspaces?page=1&limit=5')
        .expect(200));

    it('200 – supports type filter', () =>
      request(app.getHttpServer())
        .get(`/api/workspaces?type=${WorkspaceType.HOT_DESK}`)
        .expect(200));
  });

  // ── GET /api/workspaces/:id ────────────────────────────────────────────────

  describe('GET /api/workspaces/:id', () => {
    it('200 – returns workspace details', () =>
      request(app.getHttpServer())
        .get('/api/workspaces/ws-uuid-1')
        .expect(200)
        .expect((res) => expect(res.body.id).toBe('ws-uuid-1')));

    it('404 – unknown id returns not found', () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      return request(app.getHttpServer())
        .get('/api/workspaces/unknown-id')
        .expect(404);
    });
  });

  // ── PATCH /api/workspaces/:id ──────────────────────────────────────────────

  describe('PATCH /api/workspaces/:id', () => {
    it('200 – authenticated user updates workspace', () =>
      request(app.getHttpServer())
        .patch('/api/workspaces/ws-uuid-1')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .send({ name: 'Updated Desk' })
        .expect(200));

    it('401 – unauthenticated request is rejected', () =>
      request(app.getHttpServer())
        .patch('/api/workspaces/ws-uuid-1')
        .send({ name: 'Updated Desk' })
        .expect(401));
  });

  // ── DELETE /api/workspaces/:id ─────────────────────────────────────────────

  describe('DELETE /api/workspaces/:id', () => {
    it('200 – authenticated user soft-deletes workspace', () =>
      request(app.getHttpServer())
        .delete('/api/workspaces/ws-uuid-1')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .expect(200));
  });
});
