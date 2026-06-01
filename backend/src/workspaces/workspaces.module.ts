import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './workspace.entity';
import { MaintenanceWindow } from './maintenance-window.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { OccupancyStreamService } from './occupancy-stream.service';
import { Booking } from '../bookings/booking.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, MaintenanceWindow, Booking]), EmailModule],
  providers: [WorkspacesService, OccupancyStreamService],
  controllers: [WorkspacesController],
  exports: [WorkspacesService, OccupancyStreamService],
})
export class WorkspacesModule {}
