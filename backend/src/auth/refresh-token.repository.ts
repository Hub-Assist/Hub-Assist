import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken) private repo: Repository<RefreshToken>,
  ) {}

  async create(userId: string, token: string, expiresAt: Date, familyId?: string) {
    const newFamilyId = familyId || uuidv4();
    return this.repo.save(this.repo.create({ userId, token, expiresAt, familyId: newFamilyId }));
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

  async revokeTokenFamily(familyId: string) {
    await this.repo.update({ familyId }, { isRevoked: true });
  }

  async findAllUserTokenFamilies(userId: string) {
    return this.repo.find({ where: { userId } });
  }
}
