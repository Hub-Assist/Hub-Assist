import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import { WebhookService } from '../../webhooks/webhook.service';

@Injectable()
export class CreateUserProvider {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private webhookService: WebhookService,
  ) {}

  async execute(data: Partial<User>): Promise<User> {
    const user = await this.repo.save(this.repo.create(data));
    await this.webhookService.enqueue('member.joined', user);
    return user;
  }
}
