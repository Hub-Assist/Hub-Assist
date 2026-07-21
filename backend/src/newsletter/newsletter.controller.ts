import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './newsletter.dto';

@ApiTags('newsletter')
@Controller({ version: '1', path: 'newsletter' })
export class NewsletterController {
  constructor(private service: NewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  @ApiResponse({ status: 201, description: 'Subscription successful' })
  subscribe(@Body() dto: SubscribeDto, @Request() req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.service.subscribe(dto, ipAddress);
  }

  @Get('confirm')
  @ApiOperation({ summary: 'Confirm newsletter subscription' })
  @ApiQuery({ name: 'token', type: String, description: 'Confirmation token' })
  @ApiResponse({ status: 200, description: 'Subscription confirmed' })
  confirm(@Query('token') token: string) {
    return this.service.confirm(token);
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from newsletter' })
  @ApiQuery({ name: 'token', type: String, description: 'Unsubscribe token' })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  unsubscribe(@Query('token') token: string) {
    return this.service.unsubscribe(token);
  }

  @Get('subscribers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List newsletter subscribers (admin only, paginated)' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Subscribers retrieved successfully' })
  listSubscribers(@Request() req, @Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }
    return this.service.listSubscribers(page, limit);
  }
}
