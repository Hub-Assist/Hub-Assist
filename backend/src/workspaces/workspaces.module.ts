import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './workspace.entity';
import { Amenity } from './amenity.entity';
import { MaintenanceWindow } from './maintenance-window.entity';
import { WorkspacesService } from './workspaces.service';
import { AmenitiesService } from './amenities.service';
import { WorkspacesController } from './workspaces.controller';
import { AmenitiesController } from './amenities.controller';
import { OccupancyStreamService } from './occupancy-stream.service';
import { Booking } from '../bookings/booking.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, MaintenanceWindow, Booking, Amenity]), EmailModule],
  providers: [WorkspacesService, OccupancyStreamService, AmenitiesService],
  controllers: [WorkspacesController, AmenitiesController],
  exports: [WorkspacesService, OccupancyStreamService],
})
export class WorkspacesModule {}
