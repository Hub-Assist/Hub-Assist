import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    // TODO: Implement email sending via nodemailer or similar
    console.log(`Sending OTP ${otp} to ${email}`);
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    // TODO: Implement email sending via nodemailer or similar
    console.log(`Sending password reset OTP ${otp} to ${email}`);
  }

  async sendPasswordResetSuccess(email: string): Promise<void> {
    // TODO: Implement email sending via nodemailer or similar
    console.log(`Sending password reset success email to ${email}`);
  }
}
