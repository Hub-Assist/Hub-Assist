import { Controller, Get, UseInterceptors, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { Roles } from '../common/decorators/roles.decorator';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { UserRole, User } from '../users/user.entity';
import { DashboardService, ActivityFeedQuery } from './dashboard.service';
import { EventCategory } from '../audit/audit-log.entity';

@ApiTags('dashboard')
@ApiBearerAuth('bearer')
@Controller({ version: '1', path: 'dashboard' })
export class DashboardController {
  constructor(
    private service: DashboardService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('stats')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard:stats')
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  getStats() {
    return this.service.getStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get activity feed with optional filtering' })
  @ApiQuery({ name: 'eventCategory', enum: EventCategory, required: false })
  @ApiQuery({ name: 'actorId', type: String, required: false })
  @ApiQuery({ name: 'resourceId', type: String, required: false })
  @ApiQuery({ name: 'cursor', type: String, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Activity feed retrieved successfully' })
  async getActivity(
    @Query('eventCategory') eventCategory?: EventCategory,
    @Query('actorId') actorId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @GetCurrentUser() user?: User,
  ) {
    const query: ActivityFeedQuery = {
      eventCategory,
      actorId,
      resourceId,
      cursor,
      limit: limit ? Math.min(parseInt(limit, 10), 50) : 20,
    };

    return this.service.getActivity(query, user?.id, user?.role);
  }

  @Get('growth')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard:growth')
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get member growth over the last 12 months' })
  @ApiResponse({ status: 200, description: 'Member growth data retrieved successfully' })
  getGrowth() {
    return this.service.getGrowth();
  }

  @Get('admin-stats')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard:admin-stats')
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get admin statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Admin stats retrieved successfully' })
  getAdminStats() {
    return this.service.getAdminStats();
  }

  /**
   * Admin endpoint to manually flush dashboard cache.
   * Useful for testing or forcing a refresh.
   */
  @Get('admin/cache/flush')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Flush dashboard cache (admin only)' })
  @ApiResponse({ status: 200, description: 'Cache flushed successfully' })
  async flushCache() {
    await this.cacheManager.del('dashboard:stats');
    await this.cacheManager.del('dashboard:growth');
    await this.cacheManager.del('dashboard:admin-stats');
    return { message: 'Dashboard cache flushed' };
  }
}
