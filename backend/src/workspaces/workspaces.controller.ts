import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Inject,
  Req,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable, interval, mergeMap } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { OccupancyStreamService } from './occupancy-stream.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { WorkspaceType, WorkspaceAvailability } from './workspace.entity';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { CapacityCheckService } from '../bookings/capacity-check.service';

const WORKSPACES_CACHE_KEY = 'workspaces';

@ApiTags('workspaces')
@Controller({ version: '1', path: 'workspaces' })
export class WorkspacesController {
  constructor(
    private service: WorkspacesService,
    private occupancyStreamService: OccupancyStreamService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async invalidateWorkspacesCache() {
    await this.cacheManager.del(WORKSPACES_CACHE_KEY);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  async create(@Body() dto: CreateWorkspaceDto) {
    const result = await this.service.create(dto);
    await this.invalidateWorkspacesCache();
    return result;
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey(WORKSPACES_CACHE_KEY)
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ summary: 'Get all workspaces (paginated and filterable)' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'type', enum: WorkspaceType, required: false })
  @ApiQuery({ name: 'availability', enum: WorkspaceAvailability, required: false })
  @ApiResponse({ status: 200, description: 'Workspaces retrieved successfully' })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: WorkspaceType,
    @Query('availability') availability?: WorkspaceAvailability,
  ) {
    return this.service.findAll(page, limit, type, availability);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace retrieved successfully' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get hourly availability slots for a workspace on a given date' })
  @ApiParam({ name: 'id', type: String, description: 'Workspace ID' })
  @ApiQuery({ name: 'date', type: String, description: 'Date in YYYY-MM-DD format', example: '2026-06-01' })
  @ApiResponse({ status: 200, description: 'Hourly availability slots retrieved successfully' })
  async getAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return this.service.getHourlyAvailability(id, date);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AuditInterceptor)
  @Audit('workspace.updated')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update workspace' })
  @ApiParam({ name: 'id', type: String, description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto, @Req() req: any) {
    req.auditBefore = await this.service.findById(id);
    const result = await this.service.update(id, dto);
    await this.invalidateWorkspacesCache();
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete workspace (soft delete)' })
  @ApiParam({ name: 'id', type: String, description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  async delete(@Param('id') id: string) {
    const result = await this.service.softDelete(id);
    await this.invalidateWorkspacesCache();
    return result;
  }

  // ── Real-time Occupancy Streaming ──────────────────────────────────────

  @Sse(':id/occupancy/stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Stream real-time workspace occupancy updates (Server-Sent Events)',
    description: `Establishes an SSE connection that pushes occupancy updates when bookings are created, confirmed, or cancelled.
    
Supports Last-Event-ID header for client reconnection without missing events.
Send retry: 5000 to guide client reconnection interval.`,
  })
  @ApiParam({ name: 'id', type: String, description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  occupancyStream(@Param('id') workspaceId: string): Observable<MessageEvent> {
    return interval(5000).pipe(
      mergeMap(() =>
        this.occupancyStreamService.getOccupancyUpdate(workspaceId).then((update) => ({
          id: update.eventId,
          data: update,
          retry: 5000,
        } as MessageEvent)),
      ),
    );
  }
}
