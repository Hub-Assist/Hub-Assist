import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditLogEvent, AuditLogQueryDto } from './audit-log.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {}

  log(event: AuditLogEvent): void {
    setImmediate(async () => {
      try {
        await this.repo.insert(this.repo.create(event));
      } catch (error) {
        this.logger.error(`Failed to write audit log: ${(error as Error).message}`);
      }
    });
  }

  async find(query: AuditLogQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: FindOptionsWhere<AuditLog> = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.from && query.to) {
      where.createdAt = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(new Date(query.to));
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  getRetentionDays(): number {
    return this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 730);
  }
}
