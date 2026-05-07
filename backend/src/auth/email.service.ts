import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    // TODO: Implement email sending via nodemailer or similar
    this.logger.debug(`Sending OTP ${otp} to ${email}`);
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    // TODO: Implement email sending via nodemailer or similar
    this.logger.debug(`Sending password reset OTP ${otp} to ${email}`);
  }

  async sendPasswordResetSuccess(email: string): Promise<void> {
    // TODO: Implement email sending via nodemailer or similar
    this.logger.debug(`Sending password reset success email to ${email}`);
  }
}
