import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Attendance, AttendanceAction } from './attendance.entity';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AttendanceAutoCompleteService {
  private readonly logger = new Logger(AttendanceAutoCompleteService.name);

  constructor(
    @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
    private emailService: EmailService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteAbandonedSessions(): Promise<void> {
    try {
      const maxSessionHours = this.configService.get<number>('MAX_SESSION_HOURS', 12);
      const cutoffTime = new Date(Date.now() - maxSessionHours * 60 * 60 * 1000);

      // Find all open clock-in sessions older than MAX_SESSION_HOURS
      const openSessions = await this.attendanceRepo.find({
        where: {
          action: AttendanceAction.CLOCK_IN,
          timestamp: LessThan(cutoffTime),
          autoCompleted: false,
        },
        relations: ['user'],
      });

      if (openSessions.length === 0) {
        this.logger.debug('No abandoned sessions to auto-complete');
        return;
      }

      this.logger.log(`Found ${openSessions.length} abandoned sessions to auto-complete`);

      for (const session of openSessions) {
        try {
          // Create a clock-out record with auto-completed flag
          const clockOutTime = new Date(session.timestamp.getTime() + maxSessionHours * 60 * 60 * 1000);

          const clockOutRecord = this.attendanceRepo.create({
            userId: session.userId,
            action: AttendanceAction.CLOCK_OUT,
            timestamp: clockOutTime,
            sessionId: session.sessionId,
            hubId: session.hubId,
            autoCompleted: true,
            autoCompletedReason: `Auto-completed after ${maxSessionHours} hours of inactivity`,
            details: {
              originalClockInTime: session.timestamp,
              autoCompletedAt: new Date(),
            },
          });

          await this.attendanceRepo.save(clockOutRecord);

          // Mark the original session as auto-completed
          await this.attendanceRepo.update(session.id, {
            autoCompleted: true,
            autoCompletedReason: `Auto-completed after ${maxSessionHours} hours of inactivity`,
          });

          // Send email notification to user
          if (session.user?.email) {
            this.emailService
              .sendAttendanceAutoCompleted(session.user.email, {
                clockInTime: session.timestamp,
                clockOutTime,
                maxSessionHours,
              })
              .catch((err) => {
                this.logger.error(`Failed to send auto-complete email to ${session.user.email}:`, err);
              });
          }

          this.logger.log(`Auto-completed session for user ${session.userId}`);
        } catch (err) {
          this.logger.error(`Failed to auto-complete session ${session.id}:`, err);
        }
      }
    } catch (err) {
      this.logger.error('Error in autoCompleteAbandonedSessions:', err);
    }
  }
}
