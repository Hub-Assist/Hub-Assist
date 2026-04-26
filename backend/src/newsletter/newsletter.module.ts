import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterSubscriber } from './newsletter-subscriber.entity';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NewsletterSubscriber])],
  providers: [NewsletterService],
  controllers: [NewsletterController],
  exports: [NewsletterService],
})
export class NewsletterModule {}
