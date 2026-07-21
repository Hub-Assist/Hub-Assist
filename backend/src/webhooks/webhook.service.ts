import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { CreateWebhookSubscriptionDto } from './webhooks.dto';
import { WebhookDelivery, WebhookDeliveryStatus } from './webhook-delivery.entity';
import { WebhookSubscription } from './webhook-subscription.entity';

const MAX_WEBHOOK_ATTEMPTS = 8;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookSubscription) private readonly subscriptionRepo: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDelivery) private readonly deliveryRepo: Repository<WebhookDelivery>,
    private readonly configService: ConfigService,
  ) {}

  async createSubscription(dto: CreateWebhookSubscriptionDto) {
    const secret = dto.secret || randomBytes(32).toString('hex');
    const subscription = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        url: dto.url,
        eventTypes: dto.eventTypes,
        isActive: dto.isActive ?? true,
        secretHash: this.hashSecret(secret),
        encryptedSecret: this.encryptSecret(secret),
      }),
    );

    return { ...this.serializeSubscription(subscription), secret };
  }

  async enqueue(eventType: string, payload: Record<string, any>) {
    const subscriptions = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .where('subscription.isActive = true')
      .andWhere(':eventType = ANY(subscription.eventTypes)', { eventType })
      .getMany();

    if (!subscriptions.length) {
      return;
    }

    const eventPayload = {
      eventType,
      data: payload,
      createdAt: new Date().toISOString(),
    };

    await this.deliveryRepo.save(
      subscriptions.map((subscription) =>
        this.deliveryRepo.create({
          subscriptionId: subscription.id,
          eventType,
          payload: eventPayload,
          nextRetryAt: new Date(),
        }),
      ),
    );
  }

  async processReady(limit = 25): Promise<void> {
    const deliveries = await this.deliveryRepo.manager.transaction((manager) =>
      manager
        .createQueryBuilder(WebhookDelivery, 'delivery')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .leftJoinAndSelect('delivery.subscription', 'subscription')
        .where('delivery.status IN (:...statuses)', {
          statuses: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED],
        })
        .andWhere('delivery.nextRetryAt <= :now', { now: new Date() })
        .orderBy('delivery.nextRetryAt', 'ASC')
        .take(limit)
        .getMany(),
    );

    for (const delivery of deliveries) {
      await this.deliver(delivery);
    }
  }

  calculateNextRetryAt(attempts: number, now = new Date()): Date {
    const delaySeconds = 2 ** Math.max(attempts - 1, 0);
    return new Date(now.getTime() + delaySeconds * 1000);
  }

  generateSignature(secret: string, payload: Record<string, any>): string {
    const body = JSON.stringify(payload);
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  verifySignature(secret: string, payload: Record<string, any>, signature: string): boolean {
    return this.generateSignature(secret, payload) === signature;
  }

  private async deliver(delivery: WebhookDelivery): Promise<void> {
    const attempts = delivery.attempts + 1;
    const secret = this.decryptSecret(delivery.subscription.encryptedSecret);
    const signature = this.generateSignature(secret, delivery.payload);

    try {
      const response = await axios.post(delivery.subscription.url, delivery.payload, {
        timeout: 5000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Event': delivery.eventType,
          'X-Hub-Delivery': delivery.id,
          'X-Hub-Signature-256': signature,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        await this.deliveryRepo.update(delivery.id, {
          attempts,
          status: WebhookDeliveryStatus.DELIVERED,
          responseCode: response.status,
          lastError: null,
        });
        return;
      }

      await this.markForRetry(delivery, attempts, response.status, `HTTP ${response.status}`);
    } catch (error) {
      await this.markForRetry(delivery, attempts, undefined, (error as Error).message);
    }
  }

  private async markForRetry(delivery: WebhookDelivery, attempts: number, responseCode?: number, lastError?: string) {
    const isDead = attempts >= MAX_WEBHOOK_ATTEMPTS;
    await this.deliveryRepo.update(delivery.id, {
      attempts,
      responseCode,
      lastError,
      status: isDead ? WebhookDeliveryStatus.DEAD : WebhookDeliveryStatus.FAILED,
      nextRetryAt: isDead ? delivery.nextRetryAt : this.calculateNextRetryAt(attempts),
    });

    this.logger.warn(`Webhook delivery ${delivery.id} failed on attempt ${attempts}: ${lastError}`);
  }

  private serializeSubscription(subscription: WebhookSubscription) {
    const { secretHash, encryptedSecret, ...safe } = subscription;
    return safe;
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptSecret(value: string): string {
    const [ivHex, tagHex, encryptedHex] = value.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private encryptionKey(): Buffer {
    const source =
      this.configService.get<string>('WEBHOOK_SECRET_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      'hubassist-webhook-development-key';
    return createHash('sha256').update(source).digest();
  }
}
