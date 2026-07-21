import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogController } from './audit-log.controller';
import { AuditLog } from './audit-log.entity';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLogService } from './audit-log.service';

@Global()
@Module({})
export class AuditLogModule {
  static forRoot(): DynamicModule {
    return {
      module: AuditLogModule,
      imports: [TypeOrmModule.forFeature([AuditLog])],
      providers: [AuditLogService, AuditInterceptor],
      controllers: [AuditLogController],
      exports: [AuditLogService, AuditInterceptor],
    };
  }
}
