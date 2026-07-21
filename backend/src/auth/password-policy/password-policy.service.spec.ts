import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  PasswordPolicyService,
  calculateEntropy,
} from './password-policy.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigService(hibpEnabled: string): Partial<ConfigService> {
  return {
    get: jest.fn((key: string, defaultVal?: string) => {
      if (key === 'HIBP_CHECK_ENABLED') return hibpEnabled;
      return defaultVal ?? '';
    }),
  };
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('calculateEntropy', () => {
  it('returns 0 for an empty string', () => {
    expect(calculateEntropy('')).toBe(0);
  });

  it('calculates entropy for lowercase-only password', () => {
    // charset = 26, length = 8 → 8 * log2(26) ≈ 37.6
    const entropy = calculateEntropy('abcdefgh');
    expect(entropy).toBeCloseTo(37.6, 0);
  });

  it('calculates entropy for mixed-charset password', () => {
    // charset = 26+26+10+32 = 94, length = 16 → 16 * log2(94) ≈ 104.9
    const entropy = calculateEntropy('Tr0ub4dor&3xAmpl!');
    expect(entropy).toBeGreaterThan(72);
  });

  it('returns >= 72 bits for a strong 16-char mixed password', () => {
    const entropy = calculateEntropy('G7#kLmP2@qRsT9!z');
    expect(entropy).toBeGreaterThanOrEqual(72);
  });
});

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;

  // -------------------------------------------------------------------------
  // HIBP disabled (default)
  // -------------------------------------------------------------------------
  describe('with HIBP disabled', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordPolicyService,
          { provide: ConfigService, useValue: makeConfigService('false') },
        ],
      }).compile();

      service = module.get<PasswordPolicyService>(PasswordPolicyService);
    });

    it('rejects "password123" for entropy AND common-password violations', async () => {
      const result = await service.validate('password123');
      expect(result.valid).toBe(false);
      const codes = result.violations.map((v) => v.code);
      expect(codes).toContain('INSUFFICIENT_ENTROPY');
      expect(codes).toContain('COMMON_PASSWORD');
    });

    it('rejects "123456" as a common password', async () => {
      const result = await service.validate('123456');
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'COMMON_PASSWORD')).toBe(true);
    });

    it('rejects a short password for insufficient entropy', async () => {
      const result = await service.validate('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'INSUFFICIENT_ENTROPY')).toBe(true);
    });

    it('accepts a strong 16-char mixed-charset password', async () => {
      const result = await service.validate('G7#kLmP2@qRsT9!z');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('accepts a long passphrase with sufficient entropy', async () => {
      // 20 lowercase chars → 20 * log2(26) ≈ 94 bits
      const result = await service.validate('correcthorsebatterystaple');
      expect(result.valid).toBe(true);
    });

    it('returns human-readable violation messages', async () => {
      const result = await service.validate('password123');
      for (const v of result.violations) {
        expect(typeof v.message).toBe('string');
        expect(v.message.length).toBeGreaterThan(10);
      }
    });
  });

  // -------------------------------------------------------------------------
  // HIBP enabled — mock fetch
  // -------------------------------------------------------------------------
  describe('with HIBP enabled', () => {
    const KNOWN_BREACHED = 'P@ssw0rd!'; // we'll mock HIBP to say this is breached

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PasswordPolicyService,
          { provide: ConfigService, useValue: makeConfigService('true') },
        ],
      }).compile();

      service = module.get<PasswordPolicyService>(PasswordPolicyService);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('rejects a known-breached password when HIBP check is enabled', async () => {
      // Spy on checkHibp to simulate a breached result without hitting the real API
      jest.spyOn(service, 'checkHibp').mockResolvedValueOnce(true);

      const result = await service.validate(KNOWN_BREACHED);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.code === 'BREACHED_PASSWORD')).toBe(true);
    });

    it('accepts a strong password that is not in HIBP', async () => {
      jest.spyOn(service, 'checkHibp').mockResolvedValueOnce(false);

      const result = await service.validate('G7#kLmP2@qRsT9!z');
      expect(result.valid).toBe(true);
    });

    it('does not call HIBP when the password already has other violations', async () => {
      const hibpSpy = jest.spyOn(service, 'checkHibp');

      // 'password123' fails entropy + common-password, so HIBP should be skipped
      await service.validate('password123');
      expect(hibpSpy).not.toHaveBeenCalled();
    });

    it('is non-blocking when HIBP API throws an error', async () => {
      jest.spyOn(service, 'checkHibp').mockRejectedValueOnce(new Error('Network error'));

      // Should not throw; HIBP failure is best-effort
      const result = await service.validate('G7#kLmP2@qRsT9!z');
      expect(result.valid).toBe(true);
    });

    it('uses k-anonymity: checkHibp only sends the first 5 SHA-1 chars', async () => {
      // We test the real checkHibp method by mocking fetch
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => 'AABBCCDD:5\r\nEEFFGGHH:0',
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await service.checkHibp('anypassword');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      // URL should be https://api.pwnedpasswords.com/range/<5-hex-chars>
      expect(calledUrl).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/);
    });
  });
});
