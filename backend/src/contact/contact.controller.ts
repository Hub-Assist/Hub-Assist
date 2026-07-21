import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { SpamDetectionService } from './spam-detection.service';
import { SubmitContactDto } from './dto/submit-contact.dto';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ContactMessageStatus } from './contact-message.entity';
import { Request } from 'express';

@ApiTags('contact')
@Controller({ version: '1', path: 'contact' })
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly spamDetection: SpamDetectionService,
  ) {}

  // ── Public endpoint ────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a contact message',
    description: `Submits a contact message.

Submissions are scored by a heuristic spam detector. Flagged messages are saved but placed in a review queue — they are **never silently dropped**. The spam score and flags are **not** returned to the submitter.

Rate limit: 3 submissions per IP per 10 minutes (enforced by the spam detector's velocity check).`,
  })
  @ApiResponse({ status: 201, description: 'Contact message submitted successfully' })
  async submitContact(@Body() dto: SubmitContactDto, @Req() req: Request) {
    const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    return this.contactService.submitContact(dto, ipAddress);
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  @Get('messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get contact messages (admin)',
    description: 'Returns non-flagged (pending/reviewed/resolved) messages by default. Use `status=flagged` to review the spam queue.',
  })
  @ApiQuery({ name: 'status', enum: ContactMessageStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Contact messages retrieved successfully' })
  async getMessages(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: ContactMessageStatus,
  ) {
    return this.contactService.getMessages(query, status);
  }

  // ── Spam keyword management ────────────────────────────────────────────────

  @Get('admin/spam-keywords')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List all spam keywords (admin)' })
  @ApiResponse({ status: 200, description: 'Spam keywords retrieved' })
  getSpamKeywords() {
    return this.spamDetection.getAllKeywords();
  }

  @Post('admin/spam-keywords')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Add a spam keyword (admin)' })
  @ApiResponse({ status: 201, description: 'Spam keyword added' })
  addSpamKeyword(
    @Body('keyword') keyword: string,
    @Body('weight') weight?: number,
  ) {
    return this.spamDetection.addKeyword(keyword, weight);
  }

  @Delete('admin/spam-keywords/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a spam keyword (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Spam keyword removed' })
  async removeSpamKeyword(@Param('id') id: string) {
    await this.spamDetection.removeKeyword(id);
  }
}
