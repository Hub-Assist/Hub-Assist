import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { CreateWebhookSubscriptionDto } from './webhooks.dto';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ version: '1', path: 'webhooks' })
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Register a webhook subscription' })
  create(@Body() dto: CreateWebhookSubscriptionDto) {
    return this.webhookService.createSubscription(dto);
  }
}
