import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { NewsletterSubscriber } from './newsletter-subscriber.entity';
import { SubscribeDto } from './newsletter.dto';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber) private repo: Repository<NewsletterSubscriber>,
  ) {}

  async subscribe(dto: SubscribeDto, ipAddress?: string) {
    const existing = await this.repo.findOne({ where: { email: dto.email } });

    if (existing) {
      throw new BadRequestException('Email already subscribed');
    }

    const subscriber = this.repo.create({
      email: dto.email,
      confirmationToken: uuidv4(),
      unsubscribeToken: uuidv4(),
      ipAddress,
      isConfirmed: false,
    });

    await this.repo.save(subscriber);

    // TODO: Send confirmation email with token
    return { message: 'Subscription pending confirmation', email: dto.email };
  }

  async confirm(token: string) {
    const subscriber = await this.repo.findOne({ where: { confirmationToken: token } });

    if (!subscriber) {
      throw new NotFoundException('Invalid confirmation token');
    }

    if (subscriber.isConfirmed) {
      throw new BadRequestException('Already confirmed');
    }

    subscriber.isConfirmed = true;
    subscriber.confirmedAt = new Date();
    await this.repo.save(subscriber);

    // TODO: Send welcome email
    return { message: 'Subscription confirmed', email: subscriber.email };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.repo.findOne({ where: { unsubscribeToken: token } });

    if (!subscriber) {
      throw new NotFoundException('Invalid unsubscribe token');
    }

    await this.repo.delete(subscriber.id);
    return { message: 'Unsubscribed successfully' };
  }

  async listSubscribers(page: number = 1, limit: number = 10) {
    const [data, total] = await this.repo.findAndCount({
      where: { isConfirmed: true },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'email', 'subscribedAt', 'confirmedAt'],
    });

    return { data, total, page, limit };
  }
}
