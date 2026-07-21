import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UploadProfilePictureProvider } from './upload-profile-picture.provider';
import { User, UserRole } from '../user.entity';
import { ProfilePictureUrls } from '../../cloudinary/cloudinary.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    role: UserRole.MEMBER,
    isVerified: true,
    isActive: true,
    profilePicture: undefined,
    profilePictureUrls: undefined,
    createdAt: new Date(),
    ...overrides,
  } as User;
}

const MOCK_URLS: ProfilePictureUrls = {
  thumbnail: 'https://res.cloudinary.com/demo/image/upload/w_50,h_50,c_fill,g_face,q_auto,f_auto/hubassist/profile-pictures/abc',
  avatar: 'https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/hubassist/profile-pictures/abc',
  full: 'https://res.cloudinary.com/demo/image/upload/w_800,h_800,c_limit,g_auto,q_auto,f_auto/hubassist/profile-pictures/abc',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UploadProfilePictureProvider', () => {
  let provider: UploadProfilePictureProvider;

  const mockRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadProfilePictureProvider,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    provider = module.get<UploadProfilePictureProvider>(UploadProfilePictureProvider);
  });

  afterEach(() => jest.clearAllMocks());

  // ── URL persistence ──────────────────────────────────────────────────────

  describe('execute()', () => {
    it('persists all three variant URLs on the user record', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockImplementation((u: User) => Promise.resolve(u));

      const result = await provider.execute('user-1', MOCK_URLS);

      expect(result.profilePictureUrls).toEqual(MOCK_URLS);
      expect(result.profilePictureUrls?.thumbnail).toBe(MOCK_URLS.thumbnail);
      expect(result.profilePictureUrls?.avatar).toBe(MOCK_URLS.avatar);
      expect(result.profilePictureUrls?.full).toBe(MOCK_URLS.full);
    });

    it('sets legacy profilePicture to the avatar variant URL (backward compat)', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockImplementation((u: User) => Promise.resolve(u));

      const result = await provider.execute('user-1', MOCK_URLS);

      // Old single-URL field must equal the avatar variant
      expect(result.profilePicture).toBe(MOCK_URLS.avatar);
    });

    it('calls repo.save with the updated user', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockResolvedValue({ ...user, profilePictureUrls: MOCK_URLS });

      await provider.execute('user-1', MOCK_URLS);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      const savedUser: User = mockRepo.save.mock.calls[0][0];
      expect(savedUser.profilePictureUrls).toEqual(MOCK_URLS);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(provider.execute('non-existent', MOCK_URLS)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('overwrites previously stored variant URLs on re-upload', async () => {
      const oldUrls: ProfilePictureUrls = {
        thumbnail: 'https://old.url/thumb',
        avatar: 'https://old.url/avatar',
        full: 'https://old.url/full',
      };
      const user = makeUser({ profilePictureUrls: oldUrls, profilePicture: oldUrls.avatar });
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockImplementation((u: User) => Promise.resolve(u));

      const result = await provider.execute('user-1', MOCK_URLS);

      expect(result.profilePictureUrls).toEqual(MOCK_URLS);
      expect(result.profilePicture).toBe(MOCK_URLS.avatar);
    });
  });
});
