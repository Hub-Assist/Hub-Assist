import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/user.entity';
import { AuditLogQueryDto } from './audit-log.dto';
import { AuditLogService } from './audit-log.service';

@ApiTags('admin/audit-logs')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ version: '1', path: 'admin/audit-logs' })
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Query immutable audit logs' })
  find(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.find(query);
  }
}
