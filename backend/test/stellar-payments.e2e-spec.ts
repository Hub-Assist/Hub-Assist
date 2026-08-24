/**
 * E2E tests for the Stellar payment pipeline: booking → outbox → Stellar RPC →
 * webhook delivery, plus outbox/webhook retry-and-dead-letter behavior.
 *
 * The real Stellar network is never touched — StellarService is replaced with
 * a fully-controllable jest mock (StellarService itself already wraps every
 * real network call, so overriding it at the Nest DI layer is equivalent to
 * mocking the RPC boundary). Webhook deliveries are sent to a local HTTP
 * server started in-process, so no external network calls occur anywhere in
 * this file.
 *
 * Run with:
 *   npm run test:e2e -- --testPathPattern=stellar-payments
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as http from 'http';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/user.entity';
import { Workspace, WorkspaceType, WorkspaceAvailability } from '../src/workspaces/workspace.entity';
import { Booking, BookingStatus } from '../src/bookings/booking.entity';
import { OutboxEvent, OutboxEventStatus, OutboxEventType } from '../src/outbox/outbox-event.entity';
import { OutboxService } from '../src/outbox/outbox.service';
import { WebhookDelivery, WebhookDeliveryStatus } from '../src/webhooks/webhook-delivery.entity';
import { WebhookService } from '../src/webhooks/webhook.service';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const mockStellarService = {
  verifyTransaction: jest.fn(),
  publishPaymentEvent: jest.fn(),
  getBookingFromContract: jest.fn(),
  getMembershipToken: jest.fn(),
};

// ── Local HTTP receiver for webhook deliveries ───────────────────────────────
// Stands in for a customer's webhook endpoint. Captures the raw request body
// (needed to verify the HMAC signature byte-for-byte) and lets each test
// script a response sequence (e.g. fail twice, then succeed).

interface CapturedRequest {
  headers: http.IncomingHttpHeaders;
  rawBody: string;
}

function startReceiver(statusSequence: number[]): Promise<{
  port: number;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}> {
  const requests: CapturedRequest[] = [];
  let callIndex = 0;

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        requests.push({ headers: req.headers, rawBody: Buffer.concat(chunks).toString('utf8') });
        const status = statusSequence[Math.min(callIndex, statusSequence.length - 1)];
        callIndex += 1;
        res.statusCode = status;
        res.end(status >= 200 && status < 300 ? 'ok' : 'error');
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        port,
        requests,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

describe('Stellar payment pipeline (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let outboxService: OutboxService;
  let webhookService: WebhookService;
  let jwtService: JwtService;
  let adminToken: string;
  let memberToken: string;
  let workspaceId: string;
  let receiversToClose: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) throw new Error('DATABASE_URL must be set for e2e tests');
    process.env.DATABASE_URL = testDbUrl;
    process.env.NODE_ENV = 'test';
    delete process.env.REDIS_URL;

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    const { TransformInterceptor } = await import('../src/common/interceptors/transform.interceptor');
    // LoggingInterceptor is already registered globally via APP_INTERCEPTOR in
    // AppModule (with its LoggerService dependency injected) — only
    // TransformInterceptor needs to be added manually here.
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    dataSource = module.get(DataSource);
    outboxService = module.get(OutboxService);
    webhookService = module.get(WebhookService);
    jwtService = module.get(JwtService);

    const userRepo = dataSource.getRepository(User);
    const workspaceRepo = dataSource.getRepository(Workspace);

    const admin = userRepo.create({
      email: 'stellar-admin@test.com',
      passwordHash: await bcrypt.hash('pass', 10),
      role: UserRole.ADMIN,
    });
    await userRepo.save(admin);

    const member = userRepo.create({
      email: 'stellar-member@test.com',
      passwordHash: await bcrypt.hash('pass', 10),
      role: UserRole.MEMBER,
    });
    await userRepo.save(member);

    const workspace = workspaceRepo.create({
      name: 'Stellar Test Workspace',
      type: WorkspaceType.PRIVATE_OFFICE,
      capacity: 1,
      pricePerHour: 50,
      availability: WorkspaceAvailability.AVAILABLE,
    });
    await workspaceRepo.save(workspace);
    workspaceId = workspace.id;

    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
    memberToken = jwtService.sign({ sub: member.id, email: member.email, role: member.role });
  });

  afterAll(async () => {
    // Drop the database while the DataSource is still connected — app.close()
    // tears down the DataSource, so it must run first.
    await dataSource.dropDatabase();
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStellarService.verifyTransaction.mockResolvedValue({ status: 'SUCCESS' });
    mockStellarService.publishPaymentEvent.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Keep every test's outbox/webhook/booking state isolated so retry loops
    // in one test never pick up rows left behind by another. Plain DELETE
    // (not repository.clear()/TRUNCATE) respects FK dependency order without
    // Postgres rejecting the statement outright.
    await dataSource.query('DELETE FROM webhook_deliveries');
    await dataSource.query('DELETE FROM webhook_subscriptions');
    await dataSource.query('DELETE FROM outbox_events');
    await dataSource.query('DELETE FROM bookings');

    await Promise.all(receiversToClose.map((close) => close()));
    receiversToClose = [];
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  function createBooking(stellarTxHash: string) {
    const startTime = new Date(Date.now() + 86_400_000).toISOString();
    const endTime = new Date(Date.now() + 86_400_000 * 2).toISOString();

    return request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Idempotency-Key', uuidv4())
      .send({ workspaceId, startTime, endTime, stellarTxHash });
  }

  // ── 1. Booking → outbox event → mocked Stellar RPC → payment verified ────

  describe('Booking → outbox → Stellar payment verification', () => {
    it('creates an escrow outbox event on booking creation, processes it to SENT via the cron-equivalent processPending(), then confirms the booking after Stellar verifies the transaction', async () => {
      const txHash = `tx-${uuidv4()}`;

      const createRes = await createBooking(txHash).expect(201);
      const bookingId = createRes.body.data.id;
      expect(createRes.body.data.status).toBe(BookingStatus.PENDING);

      // Outbox event was created inside the same transaction as the booking.
      const outboxRepo = dataSource.getRepository(OutboxEvent);
      const escrowEvents = await outboxRepo.find({
        where: { eventType: OutboxEventType.STELLAR_ESCROW_CREATE },
      });
      const escrowEvent = escrowEvents.find((e) => e.payload.bookingId === bookingId);
      expect(escrowEvent).toBeDefined();
      expect(escrowEvent!.status).toBe(OutboxEventStatus.PENDING);
      expect(escrowEvent!.payload).toMatchObject({ bookingId, stellarTxHash: txHash });

      // Simulate the cron tick: call the same method OutboxProcessorService
      // invokes on its schedule.
      await outboxService.processPending();

      expect(mockStellarService.publishPaymentEvent).toHaveBeenCalledWith(
        OutboxEventType.STELLAR_ESCROW_CREATE,
        expect.objectContaining({ bookingId, stellarTxHash: txHash }),
      );
      const processedEscrow = await outboxRepo.findOne({ where: { id: escrowEvent!.id } });
      expect(processedEscrow!.status).toBe(OutboxEventStatus.SENT);
      expect(processedEscrow!.processedAt).not.toBeNull();

      // Admin confirms — this calls StellarService.verifyTransaction (mocked
      // "RPC") and, on SUCCESS, transitions the booking and enqueues the
      // second outbox event.
      const confirmRes = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(mockStellarService.verifyTransaction).toHaveBeenCalledWith(txHash);
      expect(confirmRes.body.data.status).toBe(BookingStatus.CONFIRMED);

      const confirmedEvents = await outboxRepo.find({
        where: { eventType: OutboxEventType.STELLAR_BOOKING_CONFIRMED },
      });
      const confirmedEvent = confirmedEvents.find((e) => e.payload.bookingId === bookingId);
      expect(confirmedEvent).toBeDefined();
      expect(confirmedEvent!.status).toBe(OutboxEventStatus.PENDING);

      await outboxService.processPending();
      const processedConfirm = await outboxRepo.findOne({ where: { id: confirmedEvent!.id } });
      expect(processedConfirm!.status).toBe(OutboxEventStatus.SENT);
    });

    it('does not confirm the booking when Stellar reports the transaction failed', async () => {
      const txHash = `tx-${uuidv4()}`;
      const createRes = await createBooking(txHash).expect(201);
      const bookingId = createRes.body.data.id;

      mockStellarService.verifyTransaction.mockResolvedValueOnce({ status: 'FAILED' });

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      const bookingRepo = dataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({ where: { id: bookingId } });
      expect(booking!.status).toBe(BookingStatus.PENDING);

      const outboxRepo = dataSource.getRepository(OutboxEvent);
      const confirmedEvents = await outboxRepo.find({
        where: { eventType: OutboxEventType.STELLAR_BOOKING_CONFIRMED },
      });
      expect(confirmedEvents.find((e) => e.payload.bookingId === bookingId)).toBeUndefined();
    });
  });

  // ── 2. Webhook delivery: HMAC signature + retry/backoff/dead-letter ──────

  describe('Webhook delivery — HMAC signature, retry, dead-letter', () => {
    async function createSubscription(url: string, secret: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ url, eventTypes: ['booking.confirmed'], secret, isActive: true })
        .expect(201);
      return res.body.data;
    }

    it('delivers a domain event with a verifiable HMAC signature', async () => {
      const receiver = await startReceiver([200]);
      receiversToClose.push(receiver.close);
      const secret = 'e2e-webhook-secret-value';

      await createSubscription(`http://127.0.0.1:${receiver.port}/hook`, secret);

      await webhookService.enqueue('booking.confirmed', { bookingId: 'b-1', totalAmount: 100 });
      await webhookService.processReady();

      expect(receiver.requests).toHaveLength(1);
      const [delivered] = receiver.requests;

      // The consumer independently recomputes the signature from the raw
      // body it received and the shared secret — proving the signature is
      // genuinely verifiable, not just present.
      const expectedSignature = `sha256=${createHmac('sha256', secret).update(delivered.rawBody).digest('hex')}`;
      expect(delivered.headers['x-hub-signature-256']).toBe(expectedSignature);
      expect(delivered.headers['x-hub-event']).toBe('booking.confirmed');

      const body = JSON.parse(delivered.rawBody);
      expect(body).toMatchObject({ eventType: 'booking.confirmed', data: { bookingId: 'b-1' } });

      const deliveryRepo = dataSource.getRepository(WebhookDelivery);
      const [delivery] = await deliveryRepo.find();
      expect(delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(delivery.responseCode).toBe(200);
      expect(delivery.attempts).toBe(1);
    });

    it('retries a failing endpoint per the exponential backoff policy and eventually dead-letters it', async () => {
      const receiver = await startReceiver([500]); // always fails
      receiversToClose.push(receiver.close);

      await createSubscription(`http://127.0.0.1:${receiver.port}/hook`, 'dead-letter-secret');
      await webhookService.enqueue('booking.confirmed', { bookingId: 'b-2' });

      const deliveryRepo = dataSource.getRepository(WebhookDelivery);

      // First attempt: verify the backoff policy is actually honored before
      // we fast-forward the remaining retries.
      await webhookService.processReady();
      let [delivery] = await deliveryRepo.find();
      expect(delivery.status).toBe(WebhookDeliveryStatus.FAILED);
      expect(delivery.attempts).toBe(1);
      const backoffMs = delivery.nextRetryAt.getTime() - Date.now();
      // calculateNextRetryAt(1) = now + 2^0s = +1s
      expect(backoffMs).toBeGreaterThan(0);
      expect(backoffMs).toBeLessThanOrEqual(2000);

      // Fast-forward through the remaining attempts (7 more, for 8 total —
      // MAX_WEBHOOK_ATTEMPTS) without waiting out real exponential delays:
      // force nextRetryAt into the past before each subsequent processReady().
      for (let attempt = 2; attempt <= 8; attempt++) {
        await deliveryRepo.update(delivery.id, { nextRetryAt: new Date(Date.now() - 1000) });
        await webhookService.processReady();
        [delivery] = await deliveryRepo.find();
      }

      expect(delivery.attempts).toBe(8);
      expect(delivery.status).toBe(WebhookDeliveryStatus.DEAD);
      expect(delivery.responseCode).toBe(500);
      expect(delivery.lastError).toContain('500');

      // Dead deliveries must never be picked up again.
      const beforeCount = receiver.requests.length;
      await webhookService.processReady();
      expect(receiver.requests.length).toBe(beforeCount);
    });

    it('recovers once the endpoint starts responding again, after transient failures', async () => {
      const receiver = await startReceiver([500, 500, 200]);
      receiversToClose.push(receiver.close);

      await createSubscription(`http://127.0.0.1:${receiver.port}/hook`, 'recovery-secret');
      await webhookService.enqueue('booking.confirmed', { bookingId: 'b-3' });

      const deliveryRepo = dataSource.getRepository(WebhookDelivery);

      for (let attempt = 1; attempt <= 3; attempt++) {
        if (attempt > 1) {
          const [current] = await deliveryRepo.find();
          await deliveryRepo.update(current.id, { nextRetryAt: new Date(Date.now() - 1000) });
        }
        await webhookService.processReady();
      }

      const [delivery] = await deliveryRepo.find();
      expect(delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(delivery.attempts).toBe(3);
      expect(receiver.requests).toHaveLength(3);
    });
  });

  // ── 3. Outbox event retry → failed/dead-letter ────────────────────────────

  describe('Outbox event retry → failed', () => {
    it('retries a persistently-failing outbox event with backoff-free re-processing and marks it failed after MAX_OUTBOX_RETRIES', async () => {
      const txHash = `tx-${uuidv4()}`;
      const createRes = await createBooking(txHash).expect(201);
      const bookingId = createRes.body.data.id;

      const outboxRepo = dataSource.getRepository(OutboxEvent);
      const [event] = await outboxRepo.find({ where: { eventType: OutboxEventType.STELLAR_ESCROW_CREATE } });
      expect(event.payload.bookingId).toBe(bookingId);

      mockStellarService.publishPaymentEvent.mockRejectedValue(new Error('Stellar RPC unreachable'));

      // MAX_OUTBOX_RETRIES = 5 in OutboxService — no delay/backoff between
      // attempts, so each processPending() call picks the same PENDING row
      // straight back up.
      for (let attempt = 1; attempt <= 5; attempt++) {
        await outboxService.processPending();
        const current = await outboxRepo.findOne({ where: { id: event.id } });
        expect(current!.retryCount).toBe(attempt);
        if (attempt < 5) {
          expect(current!.status).toBe(OutboxEventStatus.PENDING);
        } else {
          // Observed directly via repository state, as there is no
          // admin/reporting endpoint for outbox events.
          expect(current!.status).toBe(OutboxEventStatus.FAILED);
          expect(current!.processedAt).not.toBeNull();
        }
      }

      // A failed event must never be picked up again.
      const callCountBefore = mockStellarService.publishPaymentEvent.mock.calls.length;
      await outboxService.processPending();
      expect(mockStellarService.publishPaymentEvent.mock.calls.length).toBe(callCountBefore);
    });
  });
});
