import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage, ContactMessageStatus } from './contact-message.entity';
import { SubmitContactDto } from './dto/submit-contact.dto';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { paginate } from '../common/pagination/utils/paginate.util';
import { PaginatedResponse } from '../common/pagination/interface/paginated-response.interface';
import { SpamDetectionService } from './spam-detection.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepository: Repository<ContactMessage>,
    private readonly spamDetection: SpamDetectionService,
  ) {}

  async submitContact(
    dto: SubmitContactDto,
    ipAddress: string,
  ): Promise<Omit<ContactMessage, 'spamScore' | 'spamFlags'>> {
    const analysis = await this.spamDetection.analyse(
      dto.fullName,
      dto.subject,
      dto.message,
      ipAddress,
    );

    const status = this.spamDetection.isSpam(analysis.score)
      ? ContactMessageStatus.FLAGGED
      : ContactMessageStatus.PENDING;

    const contactMessage = this.contactRepository.create({
      ...dto,
      ipAddress,
      spamScore: analysis.score,
      spamFlags: analysis.flags,
      status,
    });

    const saved = await this.contactRepository.save(contactMessage);
    this.logger.log(
      `Contact message submitted from ${dto.email} | status=${status} | score=${analysis.score.toFixed(3)}`,
    );

    // Send emails asynchronously (non-blocking) — only for non-flagged messages
    if (status !== ContactMessageStatus.FLAGGED) {
      this.sendEmails(dto).catch((error) =>
        this.logger.error(`Failed to send emails: ${error.message}`),
      );
    }

    // Return the saved entity WITHOUT exposing spam internals to the submitter
    const { spamScore: _score, spamFlags: _flags, ...publicResult } = saved;
    return publicResult;
  }

  /**
   * Default admin list: excludes flagged messages.
   * Use status=flagged query param to review the spam queue.
   */
  async getMessages(
    query: PaginationQueryDto,
    status?: ContactMessageStatus,
  ): Promise<PaginatedResponse<ContactMessage>> {
    const where = status
      ? { status }
      : { status: ContactMessageStatus.PENDING };

    return paginate(query, this.contactRepository, {
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Admin: get all messages regardless of status (for full review).
   */
  async getAllMessages(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ContactMessage>> {
    return paginate(query, this.contactRepository, {
      order: { createdAt: 'DESC' },
    });
  }

  private async sendEmails(dto: SubmitContactDto): Promise<void> {
    // TODO: Implement email sending using SMTP config
    this.logger.debug(`Email sending placeholder for ${dto.email}`);
  }
}
