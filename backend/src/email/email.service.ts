import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { SmtpCircuitBreaker } from './smtp-circuit-breaker';
import { Retry } from './smtp-retry.decorator';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private fallbackMailer: MailerService | null = null;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly circuitBreaker: SmtpCircuitBreaker,
  ) {
    this.initializeFallbackMailer();
  }

  private initializeFallbackMailer(): void {
    const fallbackHost = this.configService.get('SMTP_FALLBACK_HOST');
    const fallbackPort = this.configService.get('SMTP_FALLBACK_PORT');

    if (fallbackHost && fallbackPort) {
      this.logger.log(`Fallback SMTP provider configured: ${fallbackHost}:${fallbackPort}`);
    }
  }

  @Retry({ maxAttempts: 3, backoffMs: [2 * 60 * 1000, 4 * 60 * 1000, 8 * 60 * 1000] })
  private async sendTemplate(to: string, subject: string, template: string, context: any): Promise<void> {
    try {
      if (!context) {
        throw new InternalServerErrorException(`Missing context for email template: ${template}`);
      }

      // Check circuit breaker
      if (await this.circuitBreaker.isOpen()) {
        this.logger.warn('Circuit breaker is open, routing to fallback provider');
        // In production, route to fallback provider here
        throw new Error('Circuit breaker open - fallback not configured');
      }

      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context: {
          ...context,
        },
      });

      // Record success
      await this.circuitBreaker.recordSuccess();
    } catch (error: any) {
      // Record failure
      await this.circuitBreaker.recordFailure();

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(`Email send failed: ${error.message}`, {
        to,
        template,
        errorCode: error.responseCode,
      });

      throw new InternalServerErrorException(`Failed to send email: ${error.message}`);
    }
  }

  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    if (!otp) throw new InternalServerErrorException('Missing required variable: otp');
    await this.sendTemplate(email, 'Verify Your Email', 'otp-verification', { otp });
  }

  async sendVerificationLink(email: string, link: string): Promise<void> {
    if (!link) throw new InternalServerErrorException('Missing required variable: link');
    await this.sendTemplate(email, 'Verify Your Email', 'welcome', { link });
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    if (!otp) throw new InternalServerErrorException('Missing required variable: otp');
    await this.sendTemplate(email, 'Reset Your Password', 'password-reset', { otp });
  }

  async sendPasswordResetSuccess(email: string): Promise<void> {
    await this.sendTemplate(email, 'Password Reset Successful', 'welcome', {
      message: 'Your password was successfully reset.',
    });
  }

  async sendContactConfirmation(email: string, name: string): Promise<void> {
    if (!name) throw new InternalServerErrorException('Missing required variable: name');
    await this.sendTemplate(email, 'We Received Your Message', 'welcome', {
      name,
      message: 'We have received your message and will get back to you soon.',
    });
  }

  async sendContactNotification(adminEmail: string, name: string, message: string): Promise<void> {
    if (!name || !message) throw new InternalServerErrorException('Missing required variables');
    await this.sendTemplate(adminEmail, 'New Contact Form Submission', 'welcome', { name, message });
  }

  async sendNewsletterConfirmation(email: string): Promise<void> {
    await this.sendTemplate(email, 'Confirm Your Newsletter Subscription', 'welcome', {
      message: 'Please confirm your newsletter subscription.',
    });
  }

  async sendNewsletterConfirmed(email: string): Promise<void> {
    await this.sendTemplate(email, 'Newsletter Subscription Confirmed', 'welcome', {
      message: 'Your newsletter subscription is confirmed.',
    });
  }

  async sendNewsletterUnsubscribed(email: string): Promise<void> {
    await this.sendTemplate(email, 'You Have Been Unsubscribed', 'welcome', {
      message: 'You have successfully unsubscribed from the newsletter.',
    });
  }

  async sendBookingConfirmation(email: string, bookingDetails: any): Promise<void> {
    if (!bookingDetails) throw new InternalServerErrorException('Missing required variable: bookingDetails');
    await this.sendTemplate(email, 'Booking Confirmation', 'booking-confirmation', bookingDetails);
  }

  async sendWorkspaceBookingCancelled(email: string, bookingDetails: any): Promise<void> {
    if (!bookingDetails) throw new InternalServerErrorException('Missing required variable: bookingDetails');
    await this.sendTemplate(email, 'Booking Cancelled', 'welcome', {
      message: `Your booking for ${bookingDetails.workspaceName} was cancelled because the workspace is no longer available.`,
    });
  }

  async sendAttendanceAutoCompleted(email: string, details: any): Promise<void> {
    if (!details) throw new InternalServerErrorException('Missing required variable: details');
    await this.sendTemplate(email, 'Your Clock-Out Session Was Auto-Completed', 'welcome', {
      message: `Your clock-in session that started at ${details.clockInTime.toISOString()} was automatically closed at ${details.clockOutTime.toISOString()} after ${details.maxSessionHours} hours of inactivity.`,
    });
  }
}
