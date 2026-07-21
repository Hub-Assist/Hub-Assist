import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  CLOUDINARY_PROFILE_FOLDER,
  PROFILE_PICTURE_VARIANTS,
  buildVariantUrl,
} from './cloudinary.constants';

export interface ProfilePictureUrls {
  /** 50×50 thumbnail – use for comment avatars, notification icons, etc. */
  thumbnail: string;
  /** 200×200 avatar – use for profile headers, user cards, etc. */
  avatar: string;
  /** 800×800 full – use for profile detail pages. */
  full: string;
}

export interface UploadResult extends ProfilePictureUrls {
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private cloudName: string;

  constructor(private configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME') ?? '';

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Legacy single-URL upload – kept for backward compatibility.
   * New code should use `uploadProfilePicture()` instead.
   *
   * @deprecated Use uploadProfilePicture() which returns all variant URLs.
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    const result = await this.uploadToCloudinary(file);
    return result.secure_url;
  }

  /**
   * Upload a profile picture once and derive three variant URLs via
   * Cloudinary URL transformation strings (no extra upload requests).
   *
   * Upload options applied:
   *  - `angle: 'exif'`  – auto-correct orientation from EXIF data
   *  - `face` gravity   – auto-crop to the subject's face for thumbnail/avatar
   *  - `quality: 'auto'` – Cloudinary picks the optimal quality level
   *
   * @returns UploadResult with thumbnail (50×50), avatar (200×200), full (800×800), and publicId
   */
  async uploadProfilePicture(file: Express.Multer.File): Promise<UploadResult> {
    const result = await this.uploadToCloudinary(file, {
      // Correct orientation from EXIF metadata
      transformation: [{ angle: 'exif' }],
    });

    const publicId = result.public_id;

    return {
      publicId,
      thumbnail: buildVariantUrl(this.cloudName, publicId, PROFILE_PICTURE_VARIANTS.thumbnail),
      avatar: buildVariantUrl(this.cloudName, publicId, PROFILE_PICTURE_VARIANTS.avatar),
      full: buildVariantUrl(this.cloudName, publicId, PROFILE_PICTURE_VARIANTS.full),
    };
  }

  /**
   * Delete an asset from Cloudinary by public ID.
   * Idempotent – does not throw if asset does not exist.
   */
  async deleteAsset(publicId: string): Promise<void> {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      // Ignore "not found" errors; log others
      if (error?.message?.includes('not found')) return;
      throw error;
    }
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private uploadToCloudinary(
    file: Express.Multer.File,
    extraOptions: Record<string, unknown> = {},
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_PROFILE_FOLDER,
          ...extraOptions,
        },
        (error: any, result: UploadApiResponse | undefined) => {
          if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
          else resolve(result);
        },
      );
      upload.end(file.buffer);
    });
  }
}
