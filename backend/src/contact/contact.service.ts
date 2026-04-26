import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from './contact-message.entity';
import { SubmitContactDto } from './dto/submit-contact.dto';
import { PaginationQueryDto } from '../common/pagination/dto/pagination-query.dto';
import { paginate } from '../common/pagination/utils/paginate.util';
import { PaginatedResponse } from '../common/pagination/interface/paginated-response.interface';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepository: Repository<ContactMessage>,
  ) {}

  async submitContact(
    dto: SubmitContactDto,
    ipAddress: string,
  ): Promise<ContactMessage> {
    const contactMessage = this.contactRepository.create({
      ...dto,
      ipAddress,
    });

    const saved = await this.contactRepository.save(contactMessage);
    this.logger.log(`Contact message submitted from ${dto.email}`);

    // Send emails asynchronously (non-blocking)
    this.sendEmails(dto).catch((error) =>
      this.logger.error(`Failed to send emails: ${error.message}`),
    );

    return saved;
  }

  async getMessages(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ContactMessage>> {
    return paginate(query, this.contactRepository, {
      order: { createdAt: 'DESC' },
    });
  }

  private async sendEmails(dto: SubmitContactDto): Promise<void> {
    // TODO: Implement email sending using SMTP config
    // Send confirmation email to user
    // Send notification email to admin
    this.logger.debug(`Email sending placeholder for ${dto.email}`);
  }
}
