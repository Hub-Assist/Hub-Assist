import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken) private repo: Repository<RefreshToken>,
  ) {}

  async create(userId: string, token: string, expiresAt: Date) {
    return this.repo.save(this.repo.create({ userId, token, expiresAt }));
  }

  async findByToken(token: string) {
    return this.repo.findOne({ where: { token } });
  }

  async revokeToken(id: string) {
    await this.repo.update(id, { isRevoked: true });
  }

  async revokeAllUserTokens(userId: string) {
    await this.repo.update({ userId }, { isRevoked: true });
  }
}
