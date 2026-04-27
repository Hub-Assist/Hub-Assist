import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as handlebars from 'handlebars';

jest.mock('nodemailer');
jest.mock('fs');
jest.mock('handlebars');

const sendMailMock = jest.fn();

(nodemailer.createTransport as jest.Mock).mockReturnValue({
  sendMail: sendMailMock,
});

(fs.readFileSync as jest.Mock).mockReturnValue('<p>{{otp}}</p>');
(handlebars.compile as jest.Mock).mockReturnValue((ctx: any) => `<p>${JSON.stringify(ctx)}</p>`);

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => `mock_${key}` },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('sendVerificationOtp calls sendMail with correct to and subject', async () => {
    await service.sendVerificationOtp('user@test.com', '123456');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com', subject: 'Verify Your Email' }),
    );
  });

  it('sendPasswordResetOtp calls sendMail with correct subject', async () => {
    await service.sendPasswordResetOtp('user@test.com', '654321');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com', subject: 'Reset Your Password' }),
    );
  });

  it('sendContactConfirmation calls sendMail with correct subject', async () => {
    await service.sendContactConfirmation('user@test.com', 'Alice');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com', subject: 'We Received Your Message' }),
    );
  });

  it('sendContactNotification calls sendMail with correct subject', async () => {
    await service.sendContactNotification('admin@test.com', 'Alice', 'Hello');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@test.com',
        subject: 'New Contact Form Submission',
      }),
    );
  });

  it('sendNewsletterConfirmation calls sendMail with correct subject', async () => {
    await service.sendNewsletterConfirmation('user@test.com');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Confirm Your Newsletter Subscription',
      }),
    );
  });

  it('propagates sendMail rejection', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP error'));
    await expect(service.sendVerificationOtp('user@test.com', '000')).rejects.toThrow('SMTP error');
  });
});
