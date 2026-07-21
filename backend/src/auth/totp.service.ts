import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * TOTP (Time-based One-Time Password) Service
 * Implements RFC 6238 for generating and verifying time-based OTP codes
 */
@Injectable()
export class TotpService {
  private readonly TOTP_WINDOW = 1; // Allow 1 time window before and after current time
  private readonly TIME_STEP = 30; // 30 seconds per time step (RFC 6238 default)
  private readonly DIGITS = 6; // 6-digit codes

  /**
   * Generate a new secret for TOTP
   * Returns a base32-encoded secret suitable for QR code generation
   */
  generateSecret(): string {
    // Generate 20 bytes (160 bits) of random data for the secret
    const buffer = randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Generate a QR code provisioning URI for TOTP setup
   * Compatible with Google Authenticator, Microsoft Authenticator, Authy, etc.
   */
  generateQrCodeUri(secret: string, email: string, issuer: string = 'HubAssist'): string {
    const encodedEmail = encodeURIComponent(email);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${this.DIGITS}&period=${this.TIME_STEP}`;
  }

  /**
   * Verify a TOTP code
   * Allows for time window tolerance to account for clock skew
   */
  verifyToken(secret: string, token: string): boolean {
    if (!token || token.length !== this.DIGITS) {
      return false;
    }

    const tokenNumber = parseInt(token, 10);
    if (isNaN(tokenNumber)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeCounter = Math.floor(now / this.TIME_STEP);

    // Check current time window and adjacent windows for tolerance
    for (let i = -this.TOTP_WINDOW; i <= this.TOTP_WINDOW; i++) {
      const expectedToken = this.generateHotp(secret, timeCounter + i);
      if (expectedToken === tokenNumber) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate HOTP (HMAC-based One-Time Password) for a given counter
   * Used internally by TOTP verification
   */
  private generateHotp(secret: string, counter: number): number {
    const crypto = require('crypto');
    const decodedSecret = this.base32Decode(secret);

    // Create HMAC-SHA1
    const hmac = crypto.createHmac('sha1', decodedSecret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation (RFC 4226)
    const offset = digest[digest.length - 1] & 0x0f;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return code % Math.pow(10, this.DIGITS);
  }

  /**
   * Base32 encode a buffer
   * Used for encoding the secret for display and QR codes
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decode a string
   * Used for decoding the secret during verification
   */
  private base32Decode(input: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < input.length; i++) {
      const index = alphabet.indexOf(input[i].toUpperCase());
      if (index === -1) {
        throw new Error(`Invalid base32 character: ${input[i]}`);
      }

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
