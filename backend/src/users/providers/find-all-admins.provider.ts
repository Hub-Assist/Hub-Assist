import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../user.entity';

@Injectable()
export class FindAllAdminsProvider {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async execute(skip: number = 0, take: number = 10): Promise<[User[], number]> {
    return this.repo.findAndCount({
      where: { role: UserRole.ADMIN },
      skip,
      take,
      select: ['id', 'email', 'role', 'createdAt'],
    });
  }
}
