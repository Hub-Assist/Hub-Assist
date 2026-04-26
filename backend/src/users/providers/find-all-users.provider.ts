import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class FindAllUsersProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(skip: number = 0, take: number = 10): Promise<[User[], number]> {
    return this.repo.findAndCount({
      skip,
      take,
      select: ['id', 'email', 'role', 'createdAt'],
    });
  }
}
