import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService, ProfilePictureUrls } from './cloudinary.service';
import { PROFILE_PICTURE_VARIANTS, buildVariantUrl } from './cloudinary.constants';

// ─── Mock cloudinary v2 ──────────────────────────────────────────────────────

const mockUploadStream = jest.fn();

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: mockUploadStream,
    },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'avatar.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 500, // 500 KB
    buffer: Buffer.from('fake-image-data'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

/** Simulate a successful Cloudinary upload_stream call */
function mockSuccessfulUpload(publicId: string, secureUrl: string) {
  mockUploadStream.mockImplementation((_opts: any, callback: Function) => {
    const writable = {
      end: (buffer: Buffer) => {
        callback(null, { public_id: publicId, secure_url: secureUrl });
      },
    };
    return writable;
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  const CLOUD_NAME = 'test-cloud';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                CLOUDINARY_CLOUD_NAME: CLOUD_NAME,
                CLOUDINARY_API_KEY: 'test-key',
                CLOUDINARY_API_SECRET: 'test-secret',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── uploadProfilePicture ─────────────────────────────────────────────────

  describe('uploadProfilePicture()', () => {
    it('returns all three variant URLs after a single upload', async () => {
      const publicId = 'hubassist/profile-pictures/user-abc';
      mockSuccessfulUpload(publicId, `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`);

      const result: ProfilePictureUrls = await service.uploadProfilePicture(makeFile());

      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('avatar');
      expect(result).toHaveProperty('full');
    });

    it('thumbnail URL encodes 50×50 transformation', async () => {
      const publicId = 'hubassist/profile-pictures/user-abc';
      mockSuccessfulUpload(publicId, '');

      const result = await service.uploadProfilePicture(makeFile());

      expect(result.thumbnail).toContain('w_50');
      expect(result.thumbnail).toContain('h_50');
      expect(result.thumbnail).toContain('g_face');
    });

    it('avatar URL encodes 200×200 transformation', async () => {
      const publicId = 'hubassist/profile-pictures/user-abc';
      mockSuccessfulUpload(publicId, '');

      const result = await service.uploadProfilePicture(makeFile());

      expect(result.avatar).toContain('w_200');
      expect(result.avatar).toContain('h_200');
      expect(result.avatar).toContain('g_face');
    });

    it('full URL encodes 800×800 transformation', async () => {
      const publicId = 'hubassist/profile-pictures/user-abc';
      mockSuccessfulUpload(publicId, '');

      const result = await service.uploadProfilePicture(makeFile());

      expect(result.full).toContain('w_800');
      expect(result.full).toContain('h_800');
    });

    it('all variant URLs reference the same public_id (single upload)', async () => {
      const publicId = 'hubassist/profile-pictures/unique-id-xyz';
      mockSuccessfulUpload(publicId, '');

      const result = await service.uploadProfilePicture(makeFile());

      expect(result.thumbnail).toContain(publicId);
      expect(result.avatar).toContain(publicId);
      expect(result.full).toContain(publicId);

      // upload_stream called exactly once – no extra uploads for variants
      expect(mockUploadStream).toHaveBeenCalledTimes(1);
    });

    it('variant URLs match buildVariantUrl output exactly', async () => {
      const publicId = 'hubassist/profile-pictures/user-abc';
      mockSuccessfulUpload(publicId, '');

      const result = await service.uploadProfilePicture(makeFile());

      expect(result.thumbnail).toBe(buildVariantUrl(CLOUD_NAME, publicId, PROFILE_PICTURE_VARIANTS.thumbnail));
      expect(result.avatar).toBe(buildVariantUrl(CLOUD_NAME, publicId, PROFILE_PICTURE_VARIANTS.avatar));
      expect(result.full).toBe(buildVariantUrl(CLOUD_NAME, publicId, PROFILE_PICTURE_VARIANTS.full));
    });

    it('rejects when Cloudinary returns an error', async () => {
      mockUploadStream.mockImplementation((_opts: any, callback: Function) => ({
        end: () => callback(new Error('Cloudinary network error'), undefined),
      }));

      await expect(service.uploadProfilePicture(makeFile())).rejects.toThrow(
        'Cloudinary network error',
      );
    });
  });

  // ── uploadImage (legacy) ─────────────────────────────────────────────────

  describe('uploadImage() – legacy', () => {
    it('returns a secure_url string', async () => {
      const secureUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v1/hubassist/profile-pictures/abc';
      mockSuccessfulUpload('hubassist/profile-pictures/abc', secureUrl);

      const result = await service.uploadImage(makeFile());

      expect(typeof result).toBe('string');
      expect(result).toBe(secureUrl);
    });
  });
});
