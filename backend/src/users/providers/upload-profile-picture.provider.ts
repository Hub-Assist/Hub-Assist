import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class UploadProfilePictureProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(id: string, profilePictureUrl: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.profilePicture = profilePictureUrl;
    return this.repo.save(user);
  }
}
