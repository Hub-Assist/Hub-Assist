import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });
  }

  private compileTemplate(name: string, context: any): string {
    const templatePath = path.join(__dirname, 'templates', `${name}.hbs`);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    return template(context);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM'),
      to,
      subject,
      html,
    });
  }

  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    const html = this.compileTemplate('verification-otp', { otp });
    await this.send(email, 'Verify Your Email', html);
  }

  async sendVerificationLink(email: string, link: string): Promise<void> {
    const html = this.compileTemplate('verification-link', { link });
    await this.send(email, 'Verify Your Email', html);
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    const html = this.compileTemplate('password-reset-otp', { otp });
    await this.send(email, 'Reset Your Password', html);
  }

  async sendPasswordResetSuccess(email: string): Promise<void> {
    const html = this.compileTemplate('password-reset-success', {});
    await this.send(email, 'Password Reset Successful', html);
  }

  async sendContactConfirmation(email: string, name: string): Promise<void> {
    const html = this.compileTemplate('contact-confirmation', { name });
    await this.send(email, 'We Received Your Message', html);
  }

  async sendContactNotification(adminEmail: string, name: string, message: string): Promise<void> {
    const html = this.compileTemplate('contact-notification', { name, message });
    await this.send(adminEmail, 'New Contact Form Submission', html);
  }

  async sendNewsletterConfirmation(email: string): Promise<void> {
    const html = this.compileTemplate('newsletter-confirmation', {});
    await this.send(email, 'Confirm Your Newsletter Subscription', html);
  }

  async sendNewsletterConfirmed(email: string): Promise<void> {
    const html = this.compileTemplate('newsletter-confirmed', {});
    await this.send(email, 'Newsletter Subscription Confirmed', html);
  }

  async sendNewsletterUnsubscribed(email: string): Promise<void> {
    const html = this.compileTemplate('newsletter-unsubscribed', {});
    await this.send(email, 'You Have Been Unsubscribed', html);
  }
}
