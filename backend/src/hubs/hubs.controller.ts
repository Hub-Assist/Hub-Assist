import { Controller, Post, Get, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { HubsService } from './hubs.service';
import { CreateHubDto } from './hubs.dto';

@ApiTags('hubs')
@ApiBearerAuth('bearer')
@Controller({ version: '1', path: 'hubs' })
export class HubsController {
  constructor(private service: HubsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new hub (admin only)' })
  @ApiResponse({ status: 201, description: 'Hub created successfully' })
  create(@Request() req: any, @Body() dto: CreateHubDto) {
    return this.service.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all hubs' })
  @ApiResponse({ status: 200, description: 'Hubs retrieved successfully' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get hub details with its workspaces' })
  @ApiParam({ name: 'slug', type: String })
  @ApiResponse({ status: 200, description: 'Hub retrieved successfully' })
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }
}
