import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ForgotPasswordProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(email: string): Promise<User> {
    const user = await this.repo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
