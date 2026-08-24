import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { UserSearchService } from '../src/users/services/user-search.service';
import { AuditLogService } from '../src/audit/audit-log.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { TokenBlacklistService } from '../src/auth/token-blacklist.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

// JwtStrategy verifies against process.env.JWT_SECRET (falling back to
// 'hubassist-secret') — this must match so tokens signed here validate.
const JWT_SECRET = process.env.JWT_SECRET || 'hubassist-secret';

const mockUser = {
  id: 'user-uuid-1',
  email: 'member@test.com',
  role: 'member',
  createdAt: new Date(),
};

const mockUsersService = {
  findAll: jest.fn().mockResolvedValue([[mockUser], 1]),
  findById: jest.fn().mockResolvedValue(mockUser),
  update: jest.fn().mockResolvedValue(mockUser),
  delete: jest.fn().mockResolvedValue({ message: 'Deleted' }),
  updateProfilePicture: jest.fn().mockResolvedValue({ ...mockUser, profilePictureUrl: 'http://img.url' }),
};

const mockCloudinaryService = {
  uploadImage: jest.fn().mockResolvedValue('http://img.url'),
  uploadProfilePicture: jest.fn().mockResolvedValue({
    thumbnail: 'http://img.url/thumb',
    avatar: 'http://img.url/avatar',
    full: 'http://img.url/full',
    publicId: 'fake-public-id',
  }),
};

const mockUserSearchService = {
  search: jest.fn().mockResolvedValue({ users: [mockUser], hasMore: false, nextCursor: null }),
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

describe('Users (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const makeToken = (role: string, id = 'user-uuid-1') =>
    jwtService.sign({ sub: id, email: 'user@test.com', role });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [UsersController],
      providers: [
        JwtStrategy,
        { provide: TokenBlacklistService, useValue: { isBlacklisted: jest.fn().mockResolvedValue(false) } },
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserSearchService, useValue: mockUserSearchService },
        // Not exercised by this suite (no PATCH /:id/role coverage here) — only
        // needed to satisfy AuditInterceptor's DI (eagerly instantiated).
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

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

    jwtService = module.get(JwtService);
  });

  afterAll(() => app.close());

  // ── GET /api/v1/users/search ──────────────────────────────────────────────────
  // GET /users (plain, admin-only listing) was replaced by full-text search at
  // /users/search — there is no longer a bare GET /users route.

  describe('GET /api/v1/users/search', () => {
    it('200 – admin searches users', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/search')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.users).toBeInstanceOf(Array);
          expect(res.body.data.hasMore).toBeDefined();
        }));

    it('403 – non-admin gets forbidden', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/search')
        .set('Authorization', `Bearer ${makeToken('member')}`)
        .expect(403));

    it('401 – unauthenticated gets unauthorized', () =>
      request(app.getHttpServer()).get('/api/v1/users/search').expect(401));
  });

  // ── GET /api/v1/users/:id ─────────────────────────────────────────────────────

  describe('GET /api/v1/users/:id', () => {
    it('200 – user gets own profile', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('member', 'user-uuid-1')}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe('user-uuid-1');
        }));

    it('200 – admin gets any profile', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('admin', 'admin-uuid')}`)
        .expect(200));
  });

  // ── PATCH /api/v1/users/:id ───────────────────────────────────────────────────

  describe('PATCH /api/v1/users/:id', () => {
    it('200 – user updates own profile', () =>
      request(app.getHttpServer())
        .patch('/api/v1/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('member', 'user-uuid-1')}`)
        .send({ email: 'updated@test.com' })
        .expect(200));
  });

  // ── DELETE /api/v1/users/:id ──────────────────────────────────────────────────

  describe('DELETE /api/v1/users/:id', () => {
    it('200 – admin soft-deletes user', () =>
      request(app.getHttpServer())
        .delete('/api/v1/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .expect(200));

    it('403 – non-admin gets forbidden', () =>
      request(app.getHttpServer())
        .delete('/api/v1/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('member')}`)
        .expect(403));
  });

  // ── POST /api/v1/users/:id/profile-picture ───────────────────────────────────

  describe('POST /api/v1/users/:id/profile-picture', () => {
    it('200 – uploads image and returns updated profile picture URL', () =>
      request(app.getHttpServer())
        .post('/api/v1/users/user-uuid-1/profile-picture')
        .set('Authorization', `Bearer ${makeToken('member', 'user-uuid-1')}`)
        .attach('file', Buffer.from('fake-image'), { filename: 'avatar.png', contentType: 'image/png' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.profilePictureUrl).toBeDefined();
        }));
  });
});
