import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { COMMON_PASSWORDS } from './common-passwords';

export interface PolicyViolation {
  code: string;
  message: string;
}

export interface PolicyResult {
  valid: boolean;
  violations: PolicyViolation[];
}

/**
 * Calculates the Shannon entropy of a password in bits.
 *
 * Formula: log2(charsetSize ^ length) = length * log2(charsetSize)
 *
 * Charset size is determined by which character classes are present:
 *   - lowercase letters:  26
 *   - uppercase letters:  26
 *   - digits:             10
 *   - special chars:      32  (printable ASCII outside alphanumeric)
 */
export function calculateEntropy(password: string): number {
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;
  if (charsetSize === 0) return 0;
  return password.length * Math.log2(charsetSize);
}

@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);
  private readonly MIN_ENTROPY_BITS = 72;
  private readonly hibpEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.hibpEnabled =
      this.configService.get<string>('HIBP_CHECK_ENABLED', 'false').toLowerCase() === 'true';
  }

  /**
   * Validates a password against all policy rules.
   * Returns { valid, violations[] } — violations contain human-readable messages.
   */
  async validate(password: string): Promise<PolicyResult> {
    const violations: PolicyViolation[] = [];

    // 1. Entropy check
    const entropy = calculateEntropy(password);
    if (entropy < this.MIN_ENTROPY_BITS) {
      violations.push({
        code: 'INSUFFICIENT_ENTROPY',
        message: `Password is too weak (entropy: ${entropy.toFixed(1)} bits, minimum: ${this.MIN_ENTROPY_BITS} bits). Use a longer password with a mix of uppercase, lowercase, numbers, and symbols.`,
      });
    }

    // 2. Common-password blocklist check
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      violations.push({
        code: 'COMMON_PASSWORD',
        message: 'This password is too common. Please choose a more unique password.',
      });
    }

    // 3. Optional HIBP k-anonymity check (only if no other violations to avoid leaking info)
    if (this.hibpEnabled && violations.length === 0) {
      try {
        const breached = await this.checkHibp(password);
        if (breached) {
          violations.push({
            code: 'BREACHED_PASSWORD',
            message:
              'This password has appeared in a known data breach. Please choose a different password.',
          });
        }
      } catch (err) {
        // HIBP is best-effort; log but do not block registration on API failure
        this.logger.warn(`HIBP check failed (non-blocking): ${(err as Error).message}`);
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /**
   * Checks the Have I Been Pwned API using the k-anonymity model.
   * Only the first 5 hex characters of the SHA-1 hash are sent to the API.
   * The full hash never leaves the server.
   */
  async checkHibp(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const url = `https://api.pwnedpasswords.com/range/${prefix}`;
    const response = await fetch(url, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) {
      throw new Error(`HIBP API returned status ${response.status}`);
    }

    const body = await response.text();
    const lines = body.split('\r\n');

    for (const line of lines) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix === suffix) {
        return true;
      }
    }

    return false;
  }
}
