import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscriber } from './newsletter-subscriber.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  findAndCount: jest.fn(),
});

describe('NewsletterService', () => {
  let service: NewsletterService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: getRepositoryToken(NewsletterSubscriber), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(NewsletterService);
    repo = module.get(getRepositoryToken(NewsletterSubscriber));
  });

  // ── subscribe ──────────────────────────────────────────────────────────────

  describe('subscribe', () => {
    it('creates subscriber with isConfirmed = false', async () => {
      repo.findOne.mockResolvedValue(null);
      const subscriber = { email: 'a@b.com', isConfirmed: false };
      repo.create.mockReturnValue(subscriber);
      repo.save.mockResolvedValue(subscriber);

      const result = await service.subscribe({ email: 'a@b.com' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com', isConfirmed: false }),
      );
      expect(result.email).toBe('a@b.com');
    });

    it('throws ConflictException for duplicate email', async () => {
      repo.findOne.mockResolvedValue({ email: 'a@b.com' });

      await expect(service.subscribe({ email: 'a@b.com' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── confirm ────────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('sets isConfirmed = true for valid token', async () => {
      const subscriber = { email: 'a@b.com', isConfirmed: false, confirmedAt: null };
      repo.findOne.mockResolvedValue(subscriber);
      repo.save.mockResolvedValue({ ...subscriber, isConfirmed: true });

      const result = await service.confirm('valid-token');

      expect(subscriber.isConfirmed).toBe(true);
      expect(result.email).toBe('a@b.com');
    });

    it('throws NotFoundException for invalid token', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.confirm('bad-token')).rejects.toThrow(NotFoundException);
    });
  });

  // ── unsubscribe ────────────────────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('removes subscriber for valid token', async () => {
      repo.findOne.mockResolvedValue({ id: 'uuid-1' });
      repo.delete.mockResolvedValue({});

      const result = await service.unsubscribe('valid-token');

      expect(repo.delete).toHaveBeenCalledWith('uuid-1');
      expect(result.message).toMatch(/unsubscribed/i);
    });

    it('throws NotFoundException for invalid token', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.unsubscribe('bad-token')).rejects.toThrow(NotFoundException);
    });
  });

  // ── listSubscribers ────────────────────────────────────────────────────────

  describe('listSubscribers', () => {
    it('returns paginated confirmed subscribers', async () => {
      const rows = [{ id: '1', email: 'a@b.com' }];
      repo.findAndCount.mockResolvedValue([rows, 1]);

      const result = await service.listSubscribers(1, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isConfirmed: true } }),
      );
      expect(result.data).toEqual(rows);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });
});
