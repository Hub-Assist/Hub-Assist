import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../user.entity';
import { UserSearchDto } from '../dto/user-search.dto';

@Injectable()
export class UserSearchService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  /**
   * Full-text search across name and email with multi-filter support.
   * Uses PostgreSQL tsvector GIN index for performance.
   * Results are paginated using cursor-based pagination.
   */
  async search(dto: UserSearchDto) {
    const limit = Math.min(dto.limit || 20, 100);
    const query = this.repo.createQueryBuilder('user');

    // Full-text search using plainto_tsquery for unformatted input
    if (dto.q) {
      query.andWhere(
        `user.searchVector @@ plainto_tsquery('english', :query)`,
        { query: dto.q },
      );
      // Rank results by relevance
      query.addSelect(
        `ts_rank(user.searchVector, plainto_tsquery('english', :query))`,
        'relevance',
      );
    }

    // Filter by role
    if (dto.role) {
      query.andWhere('user.role = :role', { role: dto.role });
    }

    // Filter by verification status
    if (dto.verified !== undefined) {
      query.andWhere('user.isVerified = :verified', { verified: dto.verified });
    }

    // Cursor-based pagination
    if (dto.cursor) {
      query.andWhere('user.id > :cursor', { cursor: dto.cursor });
    }

    // Order by relevance if searching, otherwise by creation date
    if (dto.q) {
      query.orderBy('relevance', 'DESC');
    } else {
      query.orderBy('user.createdAt', 'DESC');
    }

    query.addOrderBy('user.id', 'ASC');
    query.take(limit + 1); // Fetch one extra to determine if there are more results

    const results = await query.getMany();
    const hasMore = results.length > limit;
    const users = results.slice(0, limit);

    // Mask email for non-superadmin roles
    const maskedUsers = users.map((user) => ({
      ...user,
      email: user.role === UserRole.ADMIN ? user.email : this.maskEmail(user.email),
    }));

    return {
      users: maskedUsers,
      hasMore,
      nextCursor: hasMore ? users[users.length - 1].id : null,
    };
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const masked = local.substring(0, 2) + '*'.repeat(Math.max(0, local.length - 2));
    return `${masked}@${domain}`;
  }
}
