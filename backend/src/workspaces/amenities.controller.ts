import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './amenity.dto';

@ApiTags('amenities')
@Controller({ version: '1' })
export class AmenitiesController {
  constructor(private readonly service: AmenitiesService) {}

  @Get('amenities')
  @ApiOperation({ summary: 'List all available amenities' })
  async findAll() {
    return this.service.findAll();
  }

  @Post('admin/amenities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new amenity (Admin only)' })
  async create(@Body() dto: CreateAmenityDto) {
    return this.service.create(dto);
  }

  @Delete('admin/amenities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete an amenity (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
