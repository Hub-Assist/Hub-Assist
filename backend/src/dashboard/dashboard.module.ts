import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Booking } from '../bookings/booking.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Booking, Workspace, AuditLog])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
