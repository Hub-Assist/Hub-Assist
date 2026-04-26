import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class CreateUserProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(data: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }
}
