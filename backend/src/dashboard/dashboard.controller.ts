import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.service.getStats();
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  getActivity() {
    return this.service.getActivity();
  }

  @Get('admin-stats')
  @UseGuards(JwtAuthGuard)
  getAdminStats(@Request() req) {
    if (req.user.role !== 'admin') {
      return { error: 'Unauthorized' };
    }
    return this.service.getAdminStats();
  }
}
