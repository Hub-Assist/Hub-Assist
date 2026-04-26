import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class FindOneUserByEmailProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }
}
