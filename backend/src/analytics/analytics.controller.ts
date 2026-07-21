import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth('bearer')
@Roles(UserRole.ADMIN, UserRole.STAFF)
@Controller({ version: '1', path: 'analytics' })
export class AnalyticsController {
  // Simple in-process cache: key → { data, expiresAt }
  private cache = new Map<string, { data: unknown; expiresAt: number }>();
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutes

  constructor(private service: AnalyticsService) {}

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data as T;
    const data = await fn();
    this.cache.set(key, { data, expiresAt: Date.now() + this.TTL_MS });
    return data;
  }

  @Get('member-growth')
  @ApiOperation({ summary: 'Daily member registration counts for the period (admin only)' })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d'], required: false })
  @ApiResponse({ status: 200 })
  getMemberGrowth(@Query('period') period: '7d' | '30d' | '90d' = '30d') {
    return this.cached(`member-growth:${period}`, () => this.service.getMemberGrowth(period));
  }

  @Get('booking-revenue')
  @ApiOperation({ summary: 'Daily booking revenue totals for the period (admin only)' })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d'], required: false })
  @ApiResponse({ status: 200 })
  getBookingRevenue(@Query('period') period: '7d' | '30d' | '90d' = '30d') {
    return this.cached(`booking-revenue:${period}`, () => this.service.getBookingRevenue(period));
  }

  @Get('workspace-utilization')
  @ApiOperation({ summary: 'Utilization percentage per workspace (admin only)' })
  @ApiResponse({ status: 200 })
  getWorkspaceUtilization() {
    return this.cached('workspace-utilization', () => this.service.getWorkspaceUtilization());
  }

  @Get('attendance-patterns')
  @ApiOperation({ summary: 'Peak hours and day-of-week attendance patterns (admin only)' })
  @ApiResponse({ status: 200 })
  getAttendancePatterns() {
    return this.cached('attendance-patterns', () => this.service.getAttendancePatterns());
  }

  @Get('utilization')
  @ApiOperation({
    summary: 'Workspace utilization analytics with 30/60/90-day trend forecasting (admin/staff only)',
  })
  @ApiQuery({ name: 'workspaceType', type: String, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiResponse({ status: 200 })
  async getUtilizationAnalytics(
    @Query('workspaceType') workspaceType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const cacheKey = `utilization:${workspaceType || 'all'}:${startDate || 'default'}:${endDate || 'default'}`;
    return this.cached(cacheKey, () =>
      this.service.getUtilizationAnalytics(
        workspaceType,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      ),
    );
  }
}
