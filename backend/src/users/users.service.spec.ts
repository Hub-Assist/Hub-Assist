import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';
import { CreateUserProvider } from './providers/create-user.provider';
import { FindOneUserByIdProvider } from './providers/find-one-user-by-id.provider';
import { FindOneUserByEmailProvider } from './providers/find-one-user-by-email.provider';
import { FindAllUsersProvider } from './providers/find-all-users.provider';
import { FindAllAdminsProvider } from './providers/find-all-admins.provider';
import { FindAdminByIdProvider } from './providers/find-admin-by-id.provider';
import { UpdateUserProvider } from './providers/update-user.provider';
import { DeleteUserProvider } from './providers/delete-user.provider';
import { UploadProfilePictureProvider } from './providers/upload-profile-picture.provider';
import { ValidateUserProvider } from './providers/validate-user.provider';
import { ForgotPasswordProvider } from './providers/forgot-password.provider';
import { ResetPasswordProvider } from './providers/reset-password.provider';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockRepository = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        CreateUserProvider,
        FindOneUserByIdProvider,
        FindOneUserByEmailProvider,
        FindAllUsersProvider,
        FindAllAdminsProvider,
        FindAdminByIdProvider,
        UpdateUserProvider,
        DeleteUserProvider,
        UploadProfilePictureProvider,
        ValidateUserProvider,
        ForgotPasswordProvider,
        ResetPasswordProvider,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        passwordHash: 'hashedPassword',
        role: UserRole.MEMBER,
        isVerified: false,
        createdAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null for unknown email', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'unknown@example.com' },
      });
    });
  });

  describe('create', () => {
    it('should persist and return user', async () => {
      const userData: Partial<User> = {
        email: 'newuser@example.com',
        passwordHash: 'hashedPassword',
        role: UserRole.MEMBER,
      };

      const createdUser: User = {
        id: '456',
        email: 'newuser@example.com',
        passwordHash: 'hashedPassword',
        role: UserRole.MEMBER,
        isVerified: false,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(createdUser);
      mockRepository.save.mockResolvedValue(createdUser);

      const result = await service.create(userData);

      expect(result).toEqual(createdUser);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(mockRepository.save).toHaveBeenCalledWith(createdUser);
    });
  });

  describe('update', () => {
    it('should apply partial changes', async () => {
      const existingUser: User = {
        id: '789',
        email: 'existing@example.com',
        passwordHash: 'hashedPassword',
        role: UserRole.MEMBER,
        isVerified: false,
        createdAt: new Date(),
      };

      const updateData: Partial<User> = {
        isVerified: true,
        profilePicture: 'https://example.com/pic.jpg',
      };

      const updatedUser: User = {
        ...existingUser,
        ...updateData,
      };

      mockRepository.findOne.mockResolvedValue(existingUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update('789', updateData);

      expect(result).toEqual(updatedUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '789' } });
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should set isDeleted = true (soft delete)', async () => {
      const existingUser: User = {
        id: '999',
        email: 'delete@example.com',
        passwordHash: 'hashedPassword',
        role: UserRole.MEMBER,
        isVerified: false,
        createdAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(existingUser);
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete('999');

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '999' } });
      expect(mockRepository.softDelete).toHaveBeenCalledWith('999');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockUsers: User[] = [
        {
          id: '1',
          email: 'user1@example.com',
          passwordHash: 'hash1',
          role: UserRole.MEMBER,
          isVerified: false,
          createdAt: new Date(),
        },
        {
          id: '2',
          email: 'user2@example.com',
          passwordHash: 'hash2',
          role: UserRole.ADMIN,
          isVerified: true,
          createdAt: new Date(),
        },
      ];

      const total = 25;

      mockRepository.findAndCount.mockResolvedValue([mockUsers, total]);

      const result = await service.findAll(0, 10);

      expect(result).toEqual([mockUsers, total]);
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        select: ['id', 'email', 'role', 'createdAt'],
      });
    });
  });
});
