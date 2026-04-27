import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { StellarModule } from '../stellar/stellar.module';
import { Workspace } from '../workspaces/workspace.entity';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Workspace]), StellarModule],
  providers: [BookingsService, RolesGuard],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
