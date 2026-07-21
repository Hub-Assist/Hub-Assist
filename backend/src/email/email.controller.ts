import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';

@Controller('dev')
export class EmailPreviewController {
  @Get('email-preview/:template')
  previewEmail(@Param('template') template: string, @Res() res: Response) {
    // Only allow in dev (you could check process.env.NODE_ENV !== 'production' here)
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException('Cannot access dev endpoints in production');
    }

    try {
      const templatePath = path.join(__dirname, 'templates', `${template}.hbs`);
      const layoutPath = path.join(__dirname, 'templates/layouts', 'base.hbs');

      if (!fs.existsSync(templatePath)) {
        throw new NotFoundException(`Template ${template} not found`);
      }

      // Register the base layout as a partial
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      handlebars.registerPartial('base', layoutContent);

      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);

      // Dummy data for previews
      const dummyData: Record<string, any> = {
        'otp-verification': { otp: '123456' },
        'password-reset': { otp: '654321' },
        'booking-confirmation': {
          workspaceName: 'Premium Private Office',
          date: '2026-10-15',
          startTime: '09:00 AM',
          endTime: '05:00 PM',
        },
        'welcome': {
          name: 'John Doe',
          message: 'Welcome to Hub-Assist! Please verify your email.',
          link: 'http://localhost:3000/verify-email',
        },
      };

      const context = dummyData[template] || {};
      const html = compiledTemplate(context);

      res.send(html);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      res.status(500).send(`Error previewing template: ${(error as any).message}`);
    }
  }
}
