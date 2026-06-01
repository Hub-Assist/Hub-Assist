import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Booking } from '../bookings/booking.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { Attendance } from '../attendance/attendance.entity';
import { DailyUtilizationSnapshot } from './daily-utilization-snapshot.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([User, Booking, Workspace, Attendance, DailyUtilizationSnapshot]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
