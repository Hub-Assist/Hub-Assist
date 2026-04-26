import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { SubmitContactDto } from './dto/submit-contact.dto';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitContact(@Body() dto: SubmitContactDto, @Req() req: Request) {
    const ipAddress = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    return this.contactService.submitContact(dto, ipAddress);
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(@Query() query: PaginationQueryDto) {
    return this.contactService.getMessages(query);
  }
}
