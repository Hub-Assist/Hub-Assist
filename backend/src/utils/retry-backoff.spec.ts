import { calculateNextRetryAt, isDeadLetter } from './retry-backoff';

describe('retry-backoff utility', () => {
  describe('calculateNextRetryAt', () => {
    it('calculates exponential backoff delays', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');

      expect(calculateNextRetryAt(1, now).getTime() - now.getTime()).toBe(1000);
      expect(calculateNextRetryAt(2, now).getTime() - now.getTime()).toBe(2000);
      expect(calculateNextRetryAt(3, now).getTime() - now.getTime()).toBe(4000);
      expect(calculateNextRetryAt(4, now).getTime() - now.getTime()).toBe(8000);
      expect(calculateNextRetryAt(5, now).getTime() - now.getTime()).toBe(16000);
      expect(calculateNextRetryAt(8, now).getTime() - now.getTime()).toBe(128000);
    });

    it('uses current time when not provided', () => {
      const before = Date.now();
      const result = calculateNextRetryAt(1);
      const after = Date.now();

      const delay = result.getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1100);
    });
  });

  describe('isDeadLetter', () => {
    it('returns false when attempts are below max', () => {
      expect(isDeadLetter(1, 5)).toBe(false);
      expect(isDeadLetter(4, 5)).toBe(false);
    });

    it('returns true when attempts equal max', () => {
      expect(isDeadLetter(5, 5)).toBe(true);
    });

    it('returns true when attempts exceed max', () => {
      expect(isDeadLetter(6, 5)).toBe(true);
      expect(isDeadLetter(10, 5)).toBe(true);
    });
  });
});
