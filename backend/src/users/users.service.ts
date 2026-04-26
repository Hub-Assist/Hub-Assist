import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findAll() {
    return this.repo.find({ select: ['id', 'email', 'role', 'createdAt'] });
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  async updateProfilePicture(id: string, profilePictureUrl: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.profilePicture = profilePictureUrl;
    return this.repo.save(user);
  }
}
