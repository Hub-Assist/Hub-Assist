import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
import { PricingEngineService } from './pricing-engine.service';
import { CreatePriceRuleDto, UpdatePriceRuleDto } from './pricing.dto';

@ApiTags('pricing')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller({ version: '1', path: 'pricing/rules' })
export class PricingController {
  constructor(private readonly pricingEngine: PricingEngineService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a price rule for a workspace (admin)',
    description: `Creates a time-based pricing rule.

**Validation rules:**
- \`startHour\` must be < \`endHour\`
- No two active rules for the same workspace + dayOfWeek may overlap in their hour range
- \`dayOfWeek\`: 0 = Sunday, 1 = Monday … 6 = Saturday`,
  })
  @ApiResponse({ status: 201, description: 'Price rule created' })
  @ApiResponse({ status: 400, description: 'Invalid hour range' })
  @ApiResponse({ status: 409, description: 'Overlapping rule exists' })
  create(@Body() dto: CreatePriceRuleDto) {
    return this.pricingEngine.createRule(dto);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'List all price rules for a workspace (admin)' })
  @ApiParam({ name: 'workspaceId', type: String })
  @ApiResponse({ status: 200, description: 'Price rules retrieved' })
  findByWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.pricingEngine.findRulesByWorkspace(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a price rule by ID (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Price rule retrieved' })
  @ApiResponse({ status: 404, description: 'Price rule not found' })
  findById(@Param('id') id: string) {
    return this.pricingEngine.findRuleById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a price rule (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Price rule updated' })
  @ApiResponse({ status: 404, description: 'Price rule not found' })
  @ApiResponse({ status: 409, description: 'Overlapping rule exists' })
  update(@Param('id') id: string, @Body() dto: UpdatePriceRuleDto) {
    return this.pricingEngine.updateRule(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a price rule (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Price rule deleted' })
  @ApiResponse({ status: 404, description: 'Price rule not found' })
  async remove(@Param('id') id: string) {
    await this.pricingEngine.deleteRule(id);
  }
}
