import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from './contact-message.entity';
import { SpamKeyword } from './spam-keyword.entity';
import { ContactService } from './contact.service';
import { SpamDetectionService } from './spam-detection.service';
import { ContactController } from './contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage, SpamKeyword])],
  providers: [ContactService, SpamDetectionService],
  controllers: [ContactController],
})
export class ContactModule {}
