import axios from 'axios';
import { WebhookService } from './webhook.service';
import { WebhookDeliveryStatus } from './webhook-delivery.entity';

jest.mock('axios');

describe('WebhookService', () => {
  const subscriptionRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
  };
  const deliveryRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
    find: jest.fn(),
    update: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const configService = {
    get: jest.fn().mockReturnValue('test-encryption-key'),
  };

  let service: WebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookService(subscriptionRepo as any, deliveryRepo as any, configService as any);
  });

  const mockReadyDeliveries = (deliveries: any[]) => {
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(deliveries),
    };

    deliveryRepo.manager.transaction.mockImplementation((cb) =>
      cb({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    );
  };

  it('calculates exponential backoff intervals', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');

    expect(service.calculateNextRetryAt(1, now).getTime() - now.getTime()).toBe(1000);
    expect(service.calculateNextRetryAt(2, now).getTime() - now.getTime()).toBe(2000);
    expect(service.calculateNextRetryAt(8, now).getTime() - now.getTime()).toBe(128000);
  });

  it('generates and verifies HMAC signatures', () => {
    const payload = { event: 'booking.confirmed', id: 'booking-1' };
    const signature = service.generateSignature('known-secret-hash', payload);

    expect(signature).toMatch(/^sha256=/);
    expect(service.verifySignature('known-secret-hash', payload, signature)).toBe(true);
  });

  it('marks delivery as delivered on a 2xx response', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
    mockReadyDeliveries([
      {
        id: 'delivery-1',
        attempts: 0,
        payload: { id: 'booking-1' },
        eventType: 'booking.confirmed',
        subscription: { url: 'https://example.com', encryptedSecret: (service as any).encryptSecret('secret') },
      },
    ]);

    await service.processReady();

    expect(deliveryRepo.update).toHaveBeenCalledWith('delivery-1', {
      attempts: 1,
      status: WebhookDeliveryStatus.DELIVERED,
      responseCode: 200,
      lastError: null,
    });
  });

  it('retries delivery on a 5xx response', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ status: 500 });
    mockReadyDeliveries([
      {
        id: 'delivery-1',
        attempts: 0,
        nextRetryAt: new Date(),
        payload: { id: 'booking-1' },
        eventType: 'booking.confirmed',
        subscription: { url: 'https://example.com', encryptedSecret: (service as any).encryptSecret('secret') },
      },
    ]);

    await service.processReady();

    expect(deliveryRepo.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        attempts: 1,
        status: WebhookDeliveryStatus.FAILED,
        responseCode: 500,
      }),
    );
  });
});
