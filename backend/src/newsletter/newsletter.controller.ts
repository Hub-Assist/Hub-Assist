import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto } from './newsletter.dto';

@Controller('newsletter')
export class NewsletterController {
  constructor(private service: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto, @Request() req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.service.subscribe(dto, ipAddress);
  }

  @Get('confirm')
  confirm(@Query('token') token: string) {
    return this.service.confirm(token);
  }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.service.unsubscribe(token);
  }

  @Get('subscribers')
  @UseGuards(JwtAuthGuard)
  listSubscribers(@Request() req, @Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }
    return this.service.listSubscribers(page, limit);
  }
}
