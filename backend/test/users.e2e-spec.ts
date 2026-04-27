import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

const JWT_SECRET = 'hubassist-secret';

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
        { provide: UsersService, useValue: mockUsersService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = module.get(JwtService);
  });

  afterAll(() => app.close());

  // ── GET /api/users ─────────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('200 – admin gets all users', () =>
      request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.users).toBeInstanceOf(Array);
          expect(res.body.total).toBeDefined();
        }));

    it('403 – non-admin gets forbidden', () =>
      request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${makeToken('member')}`)
        .expect(403));

    it('401 – unauthenticated gets unauthorized', () =>
      request(app.getHttpServer()).get('/api/users').expect(401));
  });

  // ── GET /api/users/:id ─────────────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('200 – user gets own profile', () =>
      request(app.getHttpServer())
        .get('/api/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('member', 'user-uuid-1')}`)
        .expect(200)
        .expect((res) => expect(res.body.id).toBe('user-uuid-1')));

    it('200 – admin gets any profile', () =>
      request(app.getHttpServer())
        .get('/api/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('admin', 'admin-uuid')}`)
        .expect(200));
  });

  // ── PATCH /api/users/:id ───────────────────────────────────────────────────

  describe('PATCH /api/users/:id', () => {
    it('200 – user updates own profile', () =>
      request(app.getHttpServer())
        .patch('/api/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('member', 'user-uuid-1')}`)
        .send({ email: 'updated@test.com' })
        .expect(200));
  });

  // ── DELETE /api/users/:id ──────────────────────────────────────────────────

  describe('DELETE /api/users/:id', () => {
    it('200 – admin soft-deletes user', () =>
      request(app.getHttpServer())
        .delete('/api/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .expect(200));

    it('403 – non-admin gets forbidden', () =>
      request(app.getHttpServer())
        .delete('/api/users/user-uuid-1')
        .set('Authorization', `Bearer ${makeToken('member')}`)
        .expect(403));
  });

  // ── POST /api/users/:id/profile-picture ───────────────────────────────────

  describe('POST /api/users/:id/profile-picture', () => {
    it('200 – uploads image and returns updated profile picture URL', () =>
      request(app.getHttpServer())
        .post('/api/users/user-uuid-1/profile-picture')
        .set('Authorization', `Bearer ${makeToken('member', 'user-uuid-1')}`)
        .attach('file', Buffer.from('fake-image'), { filename: 'avatar.png', contentType: 'image/png' })
        .expect(200)
        .expect((res) => expect(res.body.profilePictureUrl).toBeDefined()));
  });
});
