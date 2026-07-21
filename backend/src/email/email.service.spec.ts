import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

describe('EmailService and Templates', () => {
  let service: EmailService;
  let mailerService: MailerService;

  const mockSendMail = jest.fn();

  beforeAll(() => {
    // Register layout for snapshot tests
    const layoutPath = path.join(__dirname, 'templates/layouts/base.hbs');
    if (fs.existsSync(layoutPath)) {
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      handlebars.registerPartial('base', layoutContent);
    }
  });

  beforeEach(async () => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: MailerService,
          useValue: {
            sendMail: mockSendMail,
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    mailerService = module.get<MailerService>(MailerService);
  });

  describe('Handlebars Templates Snapshots', () => {
    const renderTemplate = (templateName: string, context: any) => {
      const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);
      return template(context);
    };

    it('matches otp-verification snapshot', () => {
      const html = renderTemplate('otp-verification', { otp: '123456' });
      expect(html).toMatchSnapshot();
    });

    it('matches password-reset snapshot', () => {
      const html = renderTemplate('password-reset', { otp: '654321' });
      expect(html).toMatchSnapshot();
    });

    it('matches booking-confirmation snapshot', () => {
      const html = renderTemplate('booking-confirmation', {
        workspaceName: 'Premium Private Office',
        date: '2026-10-15',
        startTime: '09:00 AM',
        endTime: '05:00 PM',
      });
      expect(html).toMatchSnapshot();
    });

    it('matches welcome snapshot', () => {
      const html = renderTemplate('welcome', {
        name: 'John Doe',
        message: 'Welcome to Hub-Assist!',
        link: 'http://localhost:3000/verify',
      });
      expect(html).toMatchSnapshot();
    });
  });

  describe('EmailService', () => {
    it('throws descriptive error when required template variable is missing', async () => {
      await expect(service.sendVerificationOtp('user@test.com', '')).rejects.toThrow(InternalServerErrorException);
      await expect(service.sendVerificationOtp('user@test.com', '')).rejects.toThrow('Missing required variable: otp');
    });

    it('sendVerificationOtp calls sendMail with correct context', async () => {
      await service.sendVerificationOtp('user@test.com', '123456');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ 
          to: 'user@test.com', 
          subject: 'Verify Your Email',
          template: 'otp-verification',
          context: { otp: '123456' }
        }),
      );
    });

    it('sendBookingConfirmation calls sendMail with correct context', async () => {
      await service.sendBookingConfirmation('user@test.com', { workspaceName: 'Test' });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ 
          to: 'user@test.com', 
          subject: 'Booking Confirmation',
          template: 'booking-confirmation',
          context: { workspaceName: 'Test' }
        }),
      );
    });

    it('propagates sendMail rejection', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));
      await expect(service.sendVerificationOtp('user@test.com', '123456')).rejects.toThrow('Failed to send email: SMTP error');
    });
  });
});
