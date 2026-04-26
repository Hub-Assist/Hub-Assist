import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class UpdateUserProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(id: string, data: Partial<User>): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, data);
    return this.repo.save(user);
  }
}
