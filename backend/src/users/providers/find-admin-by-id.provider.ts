import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../user.entity';

@Injectable()
export class FindAdminByIdProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id, role: UserRole.ADMIN } });
    if (!user) {
      throw new NotFoundException('Admin not found');
    }
    return user;
  }
}
