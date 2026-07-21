import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import { CloudinaryService, UploadResult } from '../../cloudinary/cloudinary.service';

@Injectable()
export class UploadProfilePictureProvider {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Persist multi-resolution profile picture URLs on the user record.
   * Deletes the old profile picture from Cloudinary before storing the new one.
   *
   * Also writes the avatar URL to the legacy `profilePicture` column so that
   * any existing code that reads `profilePicture` continues to work without
   * modification (backward-compatible fallback).
   */
  async execute(id: string, uploadResult: UploadResult): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old profile picture if it exists
    if (user.profilePicturePublicId) {
      await this.cloudinaryService.deleteAsset(user.profilePicturePublicId);
    }

    user.profilePictureUrls = uploadResult;
    user.profilePicturePublicId = uploadResult.publicId;
    // Backward-compat: expose the avatar variant via the old single-URL field
    user.profilePicture = uploadResult.avatar;

    return this.repo.save(user);
  }
}
