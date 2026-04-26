import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ValidateUserProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(email: string, password: string): Promise<User> {
    const user = await this.repo.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Invalid credentials');
    }
    return user;
  }
}
