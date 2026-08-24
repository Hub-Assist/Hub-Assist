import { OutboxEventStatus } from './outbox-event.entity';
import { OutboxService } from './outbox.service';
import { calculateNextRetryAt } from '../utils/retry-backoff';

describe('OutboxService', () => {
  const queryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repo = {
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    manager: {
      transaction: jest.fn((cb) =>
        cb({
          createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        }),
      ),
    },
  };
  const stellarService = {
    publishPaymentEvent: jest.fn(),
  };

  let service: OutboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OutboxService(repo as any, stellarService as any);
  });

  it('marks pending events as sent when Stellar publish succeeds', async () => {
    queryBuilder.getMany.mockResolvedValue([
      { id: 'event-1', eventType: 'stellar.booking.confirmed', payload: { bookingId: 'booking-1' }, retryCount: 0 },
    ]);
    stellarService.publishPaymentEvent.mockResolvedValue(undefined);

    await service.processPending();

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        status: OutboxEventStatus.SENT,
      }),
    );
  });

  it('increments retry counter and schedules backoff when Stellar publish fails', async () => {
    queryBuilder.getMany.mockResolvedValue([
      { id: 'event-1', eventType: 'stellar.booking.confirmed', payload: { bookingId: 'booking-1' }, retryCount: 1 },
    ]);
    stellarService.publishPaymentEvent.mockRejectedValue(new Error('rpc unavailable'));

    await service.processPending();

    expect(repo.update).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        retryCount: 2,
        status: OutboxEventStatus.PENDING,
        nextRetryAt: expect.any(Date),
        processedAt: null,
      }),
    );
  });

  it('respects backoff timing and does not retry before nextRetryAt', async () => {
    const futureDate = new Date(Date.now() + 10000);
    queryBuilder.getMany.mockResolvedValue([]);

    await service.processPending();

    const callArgs = queryBuilder.andWhere.mock.calls;
    const timeCheckCall = callArgs.find((call) => call[0].includes('nextRetryAt'));
    expect(timeCheckCall).toBeDefined();
  });

  it('marks event as failed and terminal when max attempts exceeded', async () => {
    const maxAttempts = 5;
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 'event-1',
        eventType: 'stellar.booking.confirmed',
        payload: { bookingId: 'booking-1' },
        retryCount: maxAttempts - 1,
        nextRetryAt: new Date(),
      },
    ]);
    stellarService.publishPaymentEvent.mockRejectedValue(new Error('rpc unavailable'));

    await service.processPending();

    expect(repo.update).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        retryCount: maxAttempts,
        status: OutboxEventStatus.FAILED,
        processedAt: expect.any(Date),
      }),
    );
  });
});
