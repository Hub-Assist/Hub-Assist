import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class FindOneUserByIdProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }
}
