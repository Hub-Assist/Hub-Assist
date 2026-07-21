import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * AppLoggerModule — globally provides LoggerService (the app-level wrapper
 * around PinoLogger that auto-injects correlationId/userId from ALS).
 *
 * PinoLogger is already provided by LoggerModule.forRoot() registered in
 * AppModule, so we do not re-import it here — NestJS resolves it from the
 * global module registry.
 *
 * Named AppLoggerModule to avoid collision with nestjs-pino's LoggerModule.
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class AppLoggerModule {}
