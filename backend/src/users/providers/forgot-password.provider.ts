import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ForgotPasswordProvider {
  generateOtp(): string {
    return randomBytes(3).readUIntBE(0, 3).toString().slice(-6).padStart(6, '0');
  }

  async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  getOtpExpiry(): Date {
    return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  }
}
