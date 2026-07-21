import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiProduces,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ReportsService } from './reports.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';
import { BookingStatus } from '../bookings/booking.entity';
import { WorkspaceType } from '../workspaces/workspace.entity';

@ApiTags('admin / reports')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller({ version: '1', path: 'admin/reports' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── Revenue ──────────────────────────────────────────────────────────────

  @Get('revenue')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('reports:revenue')
  @CacheTTL(300) // 5-minute TTL as required
  @ApiOperation({
    summary: 'Aggregated revenue report (admin only)',
    description: `Returns revenue totals grouped by day, week, or month for the given date range.

**Filters**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | ISO date | Start of range (default: 30 days ago) |
| endDate | ISO date | End of range (default: today) |
| workspaceType | enum | Filter by workspace type |
| status | enum | Filter by booking status |
| groupBy | day \\| week \\| month | Aggregation granularity (default: day) |

**Performance**: Uses the \`idx_bookings_workspaceid_starttime_endtime\` index for date-range filtering.

**Security**: Admin-only endpoint. Returns 403 for non-admin roles.`,
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-01-01', description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-01-31', description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'workspaceType', required: false, enum: WorkspaceType, description: 'Filter by workspace type' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus, description: 'Filter by booking status' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], description: 'Aggregation granularity' })
  @ApiResponse({
    status: 200,
    description: 'Revenue report retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            totalRevenue: { type: 'number', example: 12500.0 },
            totalBookings: { type: 'number', example: 87 },
            averageBookingValue: { type: 'number', example: 143.68 },
            startDate: { type: 'string', example: '2024-01-01' },
            endDate: { type: 'string', example: '2024-01-31' },
          },
        },
        breakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              period: { type: 'string', example: '2024-01-15' },
              totalRevenue: { type: 'number', example: 450.0 },
              bookingCount: { type: 'number', example: 3 },
              averageBookingValue: { type: 'number', example: 150.0 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  getRevenue(@Query() query: RevenueQueryDto) {
    return this.reportsService.getRevenue(query);
  }

  // ─── Revenue CSV Export ───────────────────────────────────────────────────

  @Get('revenue/export')
  @ApiOperation({
    summary: 'Export revenue report as CSV (admin only)',
    description: `Streams a CSV file with the same filters as GET /admin/reports/revenue.

The response includes a \`Content-Disposition: attachment; filename="revenue-report-<date>.csv"\` header.

**CSV columns**: period, totalRevenue, bookingCount, averageBookingValue`,
  })
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'startDate', required: false, example: '2024-01-01', description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-01-31', description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'workspaceType', required: false, enum: WorkspaceType, description: 'Filter by workspace type' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus, description: 'Filter by booking status' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], description: 'Aggregation granularity' })
  @ApiResponse({ status: 200, description: 'CSV file streamed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  async exportRevenueCsv(@Query() query: RevenueQueryDto, @Res() res: Response) {
    const csv = await this.reportsService.getRevenueCsv(query);
    const dateTag = new Date().toISOString().split('T')[0];
    const filename = `revenue-report-${dateTag}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  // ─── Occupancy ────────────────────────────────────────────────────────────

  @Get('occupancy')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('reports:occupancy')
  @CacheTTL(300) // 5-minute TTL
  @ApiOperation({
    summary: 'Workspace utilization / occupancy report (admin only)',
    description: `Returns utilization percentages for each active workspace over the given period.

**Utilization formula**: (total confirmed booked hours) / (period hours × capacity) × 100

**Filters**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | ISO date | Start of range (default: 30 days ago) |
| endDate | ISO date | End of range (default: today) |
| workspaceType | enum | Filter by workspace type |`,
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-01-01', description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-01-31', description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'workspaceType', required: false, enum: WorkspaceType, description: 'Filter by workspace type' })
  @ApiResponse({
    status: 200,
    description: 'Occupancy report retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', example: '2024-01-01' },
        endDate: { type: 'string', example: '2024-01-31' },
        overallUtilizationPct: { type: 'number', example: 42.5 },
        workspaces: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              workspaceId: { type: 'string', format: 'uuid' },
              workspaceName: { type: 'string', example: 'Hot Desk A' },
              workspaceType: { type: 'string', enum: Object.values(WorkspaceType) },
              capacity: { type: 'number', example: 4 },
              totalBookings: { type: 'number', example: 12 },
              confirmedBookings: { type: 'number', example: 10 },
              totalBookedHours: { type: 'number', example: 80.0 },
              availableHours: { type: 'number', example: 744.0 },
              utilizationPct: { type: 'number', example: 10.8 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden – admin role required' })
  getOccupancy(@Query() query: OccupancyQueryDto) {
    return this.reportsService.getOccupancy(query);
  }
}
