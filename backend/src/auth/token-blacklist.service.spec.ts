import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  const mockCacheManager = {
    set: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── blacklistToken ──────────────────────────────────────────────────────────

  describe('blacklistToken', () => {
    it('stores the jti in cache with the given TTL', async () => {
      const jti = 'test-jti-uuid-v4';
      const ttlMs = 3_600_000; // 1 hour

      await service.blacklistToken(jti, ttlMs);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `blacklist:jti:${jti}`,
        '1',
        ttlMs,
      );
    });

    it('does NOT call cache.set when TTL is zero (already expired)', async () => {
      await service.blacklistToken('some-jti', 0);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('does NOT call cache.set when TTL is negative', async () => {
      await service.blacklistToken('some-jti', -1000);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  // ── isBlacklisted ───────────────────────────────────────────────────────────

  describe('isBlacklisted', () => {
    it('returns false when jti is NOT in the blacklist (cache miss)', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.isBlacklisted('clean-jti');

      expect(result).toBe(false);
      expect(mockCacheManager.get).toHaveBeenCalledWith('blacklist:jti:clean-jti');
    });

    it('returns false when cache returns undefined', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.isBlacklisted('clean-jti');

      expect(result).toBe(false);
    });

    it('returns true when jti IS in the blacklist (cache hit)', async () => {
      mockCacheManager.get.mockResolvedValue('1');

      const result = await service.isBlacklisted('revoked-jti');

      expect(result).toBe(true);
      expect(mockCacheManager.get).toHaveBeenCalledWith('blacklist:jti:revoked-jti');
    });

    it('uses a single GET — no list scans', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.isBlacklisted('any-jti');

      // Only one cache interaction per check
      expect(mockCacheManager.get).toHaveBeenCalledTimes(1);
    });
  });

  // ── TTL alignment ───────────────────────────────────────────────────────────

  describe('TTL alignment', () => {
    it('passes the exact remaining TTL to the cache store', async () => {
      const remainingMs = 1_234_567;
      await service.blacklistToken('ttl-test-jti', remainingMs);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        '1',
        remainingMs,
      );
    });
  });
});
