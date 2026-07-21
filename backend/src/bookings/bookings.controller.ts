import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { BookingsService } from './bookings.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { CreateBookingDto, UpdateBookingDto } from './bookings.dto';
import {
  CreateCancellationPolicyDto,
  UpdateCancellationPolicyDto,
} from './cancellation-policy.dto';
import { WorkspaceType } from '../workspaces/workspace.entity';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';

@ApiTags('bookings')
@ApiBearerAuth('bearer')
@Controller({ version: '1', path: 'bookings' })
export class BookingsController {
  constructor(
    private service: BookingsService,
    private cancellationPolicyService: CancellationPolicyService,
  ) {}

  // ── Bookings ───────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a new booking (or recurring series)',
    description: `Creates a new booking or a recurring series with **dynamic pricing**.

## Pricing Rules

Booking cost is calculated by the PricingEngine using time-of-day rates, day-of-week multipliers, and membership tier discounts.

### Rate Snapshot
The full pricing breakdown is stored in \`appliedRateSnapshot\` (JSONB) on the booking record for historical auditability.

**Recurring series:** Include an RFC 5545 RRULE string in \`recurrenceRule\`.

### Conflict Rules
| Condition | Description |
|-----------|-------------|
| Maintenance Window | The requested time falls within an admin-set maintenance window |
| Capacity Limits | The requested time exceeds the maximum capacity of the workspace |
| Overlapping Time | For a single-capacity workspace, another booking already occupies the time range |`,
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description:
      'Client-generated unique key (UUID v4 recommended) that prevents duplicate bookings ' +
      'caused by network retries or UI double-submits. ' +
      'The same key scoped to the same user returns the original response for up to 5 minutes. ' +
      'Must be 1–128 printable ASCII characters with no whitespace. **Required.**',
    required: true,
    schema: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
  })
  @ApiResponse({ status: 201, description: 'Booking (or series) created successfully' })
  @ApiResponse({
    status: 200,
    description: 'Duplicate request — original response replayed (idempotent)',
  })
  @ApiResponse({
    status: 409,
    description: 'Workspace booking conflict detected OR concurrent duplicate key in-flight',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: { type: 'string', example: 'Workspace booking conflict detected' },
        conflictDetail: {
          type: 'object',
          properties: {
            reason: { type: 'string', example: 'Capacity Exceeded' },
            conflictingBookingId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            overlappingWindow: {
              type: 'object',
              properties: {
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Missing or malformed X-Idempotency-Key header',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: { type: 'string', example: 'X-Idempotency-Key header is required for this endpoint' },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  create(@Request() req: any, @Body() dto: CreateBookingDto) {
    return this.service.create(req.user.id, dto, req.user.role ?? 'member');
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

  @Get('workspace/:workspaceId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get bookings for a workspace' })
  @ApiParam({ name: 'workspaceId', type: String, description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace bookings retrieved successfully' })
  findByWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.service.findByWorkspace(workspaceId);
  }

  @Get('series/:seriesId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all instances of a recurring series' })
  @ApiParam({ name: 'seriesId', type: String, description: 'Series UUID' })
  @ApiResponse({ status: 200, description: 'Series instances retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  findBySeries(@Param('seriesId') seriesId: string) {
    return this.service.findBySeries(seriesId);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(AuditInterceptor)
  @Roles(UserRole.ADMIN)
  @Audit('booking.confirmed')
  @ApiOperation({ summary: 'Confirm booking (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking confirmed successfully' })
  async confirm(@Param('id') id: string, @Request() req: any) {
    req.auditBefore = await this.service.findById(id);
    return this.service.confirm(id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancel a single booking',
    description: `Cancels a booking and evaluates the refund based on the cancellation policy.

**Refund Policy (default — override per workspace type via admin endpoints):**
| Hours before start | Refund |
|--------------------|--------|
| ≥ 24 h | 100% (full refund) |
| < 24 h | 0% (no refund) |

The \`refundAmount\` is stored on the booking record.`,
  })
  @ApiParam({ name: 'id', type: String, description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled. Response includes refundAmount.',
  })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.service.cancel(id, req.user.id);
  }

  @Delete('series/:seriesId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancel all future instances of a recurring series',
    description: `Cancels all future instances (startTime > now) of a recurring series.
Past instances are preserved. Each cancelled instance has its refund amount evaluated
and stored according to the cancellation policy.`,
  })
  @ApiParam({ name: 'seriesId', type: String, description: 'Series UUID' })
  @ApiResponse({
    status: 200,
    description: 'Future series instances cancelled. Past instances preserved.',
    schema: {
      type: 'object',
      properties: {
        cancelledCount: { type: 'number', example: 3 },
        preservedCount: { type: 'number', example: 1 },
        message: { type: 'string', example: 'Cancelled 3 future instance(s). Past instances preserved.' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not authorized to cancel this series' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  cancelSeries(@Param('seriesId') seriesId: string, @Request() req: any) {
    return this.service.cancelSeries(seriesId, req.user.id);
  }

  // ── Cancellation Policies (admin) ──────────────────────────────────────────

  @Get('policies/cancellation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all cancellation policies (admin only)',
    description: `Returns all configured cancellation policies per workspace type.

**Refund Bracket Formula:**
\`\`\`
refundAmount = totalAmount × (refundPercent / 100)
\`\`\`

**Default fallback** (when no policy is configured for a workspace type):
- Full refund if cancelled > 24 h before start
- No refund otherwise`,
  })
  @ApiResponse({ status: 200, description: 'Cancellation policies retrieved' })
  listPolicies() {
    return this.cancellationPolicyService.findAll();
  }

  @Post('policies/cancellation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a cancellation policy for a workspace type (admin only)',
    description: `Creates a refund policy for a specific workspace type.
One policy per workspace type. Policy changes do NOT retroactively affect existing bookings.`,
  })
  @ApiResponse({ status: 201, description: 'Policy created' })
  @ApiResponse({ status: 409, description: 'Policy already exists for this workspace type' })
  createPolicy(@Body() dto: CreateCancellationPolicyDto) {
    return this.cancellationPolicyService.create(dto);
  }

  @Patch('policies/cancellation/:workspaceType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a cancellation policy (admin only)',
    description: 'Updates an existing cancellation policy. Changes apply to future cancellations only.',
  })
  @ApiParam({
    name: 'workspaceType',
    enum: WorkspaceType,
    description: 'Workspace type to update policy for',
  })
  @ApiResponse({ status: 200, description: 'Policy updated' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  updatePolicy(
    @Param('workspaceType') workspaceType: WorkspaceType,
    @Body() dto: UpdateCancellationPolicyDto,
  ) {
    return this.cancellationPolicyService.update(workspaceType, dto);
  }

  @Delete('policies/cancellation/:workspaceType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a cancellation policy (admin only)',
    description: 'Removes the policy. The default fallback policy will apply after deletion.',
  })
  @ApiParam({
    name: 'workspaceType',
    enum: WorkspaceType,
    description: 'Workspace type to remove policy for',
  })
  @ApiResponse({ status: 200, description: 'Policy deleted' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  removePolicy(@Param('workspaceType') workspaceType: WorkspaceType) {
    return this.cancellationPolicyService.remove(workspaceType);
  }
}
