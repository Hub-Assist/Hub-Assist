import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto } from './bookings.dto';

@ApiTags('bookings')
@ApiBearerAuth('bearer')
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
   create(@Request() req: any, @Body() dto: CreateBookingDto) {
     return this.service.create(req.user.id, dto);
   }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all bookings (user sees own, admin sees all)' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
   findAll(@Request() req: any) {
     const isAdmin = req.user.role === 'admin';
     return this.service.findAll(isAdmin ? undefined : req.user.id, isAdmin);
   }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm booking' })
  @ApiParam({ name: 'id', type: String, description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking confirmed successfully' })
  confirm(@Param('id') id: string) {
    return this.service.confirm(id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiParam({ name: 'id', type: String, description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
   cancel(@Param('id') id: string, @Request() req: any) {
     return this.service.cancel(id, req.user.id);
   }

  @Get('workspace/:workspaceId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get bookings for a workspace' })
  @ApiParam({ name: 'workspaceId', type: String, description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace bookings retrieved successfully' })
  findByWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.service.findByWorkspace(workspaceId);
  }
}
