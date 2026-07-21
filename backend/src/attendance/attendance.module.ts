import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Attendance } from './attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceAutoCompleteService } from './attendance-auto-complete.service';
import { AttendanceController } from './attendance.controller';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    ScheduleModule.forRoot(),
    EmailModule,
    UsersModule,
  ],
  providers: [AttendanceService, AttendanceAutoCompleteService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
