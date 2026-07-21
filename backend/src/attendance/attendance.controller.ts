import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AttendanceService } from './attendance.service';
import { ClockInDto, ClockOutDto, AttendanceSummaryQueryDto } from './attendance.dto';
import { CursorPaginationQueryDto } from '../common/pagination/dto/cursor-pagination-query.dto';

@ApiTags('attendance')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ version: '1', path: 'attendance' })
@ApiExtraModels(AttendanceSummaryQueryDto)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  @ApiOperation({ summary: 'Record a clock-in event' })
  @ApiResponse({
    status: 201,
    description: 'Clock-in recorded successfully',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async clockIn(@Request() req: any, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(req.user.id, dto);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Record a clock-out event' })
  @ApiResponse({
    status: 200,
    description: 'Clock-out recorded successfully',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        sessionDuration: { type: 'number', description: 'Duration in seconds' },
      },
    },
  })
  async clockOut(@Request() req: any, @Body() dto: ClockOutDto) {
    return this.attendanceService.clockOut(req.user.id, dto);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Get current user attendance history (cursor-paginated)',
    description:
      'Returns a page of attendance records ordered by timestamp DESC. ' +
      'Pass the `nextCursor` value from the previous response as the `cursor` ' +
      'query parameter to fetch the next page. Omit `cursor` to start from the ' +
      'most recent record.',
  })
  @ApiQuery({ name: 'cursor', type: String, required: false, description: 'Opaque cursor token from the previous page `nextCursor` field.' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20, description: 'Number of records per page (1–100, default 20).' })
  @ApiResponse({ status: 200, description: 'Attendance history retrieved successfully' })
  async getMyAttendance(
    @Request() req: any,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.attendanceService.getMyAttendance(req.user.sub ?? req.user.id, query);
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get specific user attendance history (admin only, paginated)' })
  @ApiParam({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'User attendance history retrieved successfully' })
  async getUserAttendance(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.attendanceService.getUserAttendance(userId, page, limit);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get attendance summary with timezone-aware aggregations (admin only)',
    description: `Returns daily/weekly/monthly session counts and durations bucketed in the
requested IANA timezone. Anomalous sessions (< 5 min or > 14 h) are flagged.
Peak arrival and departure hours are computed in the requested timezone.

See **docs/logging.md** for correlation ID usage and **docs/attendance-summary.md**
for the full response schema.`,
  })
  @ApiQuery({
    name: 'timezone',
    required: false,
    type: String,
    description: 'IANA timezone (e.g. "America/New_York"). Defaults to UTC.',
    example: 'America/New_York',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Aggregation period. Defaults to "daily".',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'ISO 8601 start of window. Defaults to 30 days ago.',
    example: '2026-05-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'ISO 8601 end of window. Defaults to now.',
    example: '2026-05-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timezone:             { type: 'string', example: 'America/New_York' },
        period:               { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
        startDate:            { type: 'string', format: 'date-time' },
        endDate:              { type: 'string', format: 'date-time' },
        totalSessions:        { type: 'number' },
        totalDurationSeconds: { type: 'number' },
        avgDurationSeconds:   { type: 'number' },
        peakArrivalHour:      { type: 'number', nullable: true, description: '0–23 in requested timezone' },
        peakDepartureHour:    { type: 'number', nullable: true, description: '0–23 in requested timezone' },
        buckets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              bucket:               { type: 'string', example: '2026-05-30' },
              sessions:             { type: 'number' },
              totalDurationSeconds: { type: 'number' },
              avgDurationSeconds:   { type: 'number' },
              anomalies: {
                type: 'object',
                properties: {
                  short: { type: 'number', description: 'Sessions under 5 minutes' },
                  long:  { type: 'number', description: 'Sessions over 14 hours' },
                },
              },
            },
          },
        },
        anomalies: {
          type: 'array',
          description: 'All sessions flagged as anomalous',
          items: {
            type: 'object',
            properties: {
              sessionId:        { type: 'string', format: 'uuid' },
              userId:           { type: 'string', format: 'uuid' },
              clockInUtc:       { type: 'string', format: 'date-time' },
              clockOutUtc:      { type: 'string', format: 'date-time' },
              durationSeconds:  { type: 'number' },
              anomaly:          { type: 'string', enum: ['short', 'long'] },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid timezone or date parameter' })
  async getAttendanceSummary(@Query() query: AttendanceSummaryQueryDto) {
    return this.attendanceService.getAttendanceSummary(query);
  }

  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all attendance records with optional filters (admin only, paginated)',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiQuery({ name: 'userId', type: String, required: false, description: 'Filter by user ID' })
  @ApiQuery({
    name: 'action',
    enum: AttendanceAction,
    required: false,
    description: 'Filter by action (clock_in or clock_out)',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: false,
    description: 'Filter by start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: false,
    description: 'Filter by end date (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'All attendance records retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        records: { type: 'array' },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        pages: { type: 'number' },
      },
    },
  })
  async getAllAttendance(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('userId') userId?: string,
    @Query('action') action?: AttendanceAction,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = {
      userId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.attendanceService.getAllAttendance(page, limit, filters);
  }
}
