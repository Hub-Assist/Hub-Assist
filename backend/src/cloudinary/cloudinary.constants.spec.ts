import {
  buildVariantUrl,
  PROFILE_PICTURE_VARIANTS,
  CLOUDINARY_PROFILE_FOLDER,
} from './cloudinary.constants';

describe('Cloudinary constants', () => {
  const CLOUD_NAME = 'test-cloud';
  const PUBLIC_ID = 'hubassist/profile-pictures/user123';

  describe('PROFILE_PICTURE_VARIANTS', () => {
    it('defines thumbnail as 50×50 with face gravity', () => {
      const v = PROFILE_PICTURE_VARIANTS.thumbnail;
      expect(v.width).toBe(50);
      expect(v.height).toBe(50);
      expect(v.gravity).toBe('face');
      expect(v.crop).toBe('fill');
    });

    it('defines avatar as 200×200 with face gravity', () => {
      const v = PROFILE_PICTURE_VARIANTS.avatar;
      expect(v.width).toBe(200);
      expect(v.height).toBe(200);
      expect(v.gravity).toBe('face');
      expect(v.crop).toBe('fill');
    });

    it('defines full as 800×800 with auto gravity', () => {
      const v = PROFILE_PICTURE_VARIANTS.full;
      expect(v.width).toBe(800);
      expect(v.height).toBe(800);
      expect(v.gravity).toBe('auto');
      expect(v.crop).toBe('limit');
    });
  });

  describe('buildVariantUrl()', () => {
    it('generates correct thumbnail URL with transformation parameters', () => {
      const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.thumbnail);
      expect(url).toBe(
        `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_50,h_50,c_fill,g_face,q_auto,f_auto/${PUBLIC_ID}`,
      );
    });

    it('generates correct avatar URL with transformation parameters', () => {
      const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.avatar);
      expect(url).toBe(
        `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/${PUBLIC_ID}`,
      );
    });

    it('generates correct full URL with transformation parameters', () => {
      const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.full);
      expect(url).toBe(
        `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_800,h_800,c_limit,g_auto,q_auto,f_auto/${PUBLIC_ID}`,
      );
    });

    it('all three variant URLs share the same public_id path', () => {
      const thumbnail = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.thumbnail);
      const avatar = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.avatar);
      const full = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.full);

      // All derived from the same upload – only the transformation segment differs
      expect(thumbnail).toContain(PUBLIC_ID);
      expect(avatar).toContain(PUBLIC_ID);
      expect(full).toContain(PUBLIC_ID);

      // Transformation segments are distinct
      expect(thumbnail).not.toBe(avatar);
      expect(avatar).not.toBe(full);
      expect(thumbnail).not.toBe(full);
    });

    it('thumbnail URL contains w_50 and h_50', () => {
      const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.thumbnail);
      expect(url).toContain('w_50');
      expect(url).toContain('h_50');
    });

    it('avatar URL contains w_200 and h_200', () => {
      const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.avatar);
      expect(url).toContain('w_200');
      expect(url).toContain('h_200');
    });

    it('full URL contains w_800 and h_800', () => {
      const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, PROFILE_PICTURE_VARIANTS.full);
      expect(url).toContain('w_800');
      expect(url).toContain('h_800');
    });

    it('all URLs include q_auto and f_auto for quality/format optimisation', () => {
      for (const variant of Object.values(PROFILE_PICTURE_VARIANTS)) {
        const url = buildVariantUrl(CLOUD_NAME, PUBLIC_ID, variant);
        expect(url).toContain('q_auto');
        expect(url).toContain('f_auto');
      }
    });
  });

  describe('CLOUDINARY_PROFILE_FOLDER', () => {
    it('is set to the expected folder path', () => {
      expect(CLOUDINARY_PROFILE_FOLDER).toBe('hubassist/profile-pictures');
    });
  });
});
