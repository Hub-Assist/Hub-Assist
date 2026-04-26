import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ResetPasswordProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(id: string, newPassword: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    return this.repo.save(user);
  }
}
