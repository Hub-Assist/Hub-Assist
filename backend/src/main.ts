import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './utils/error';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // Security headers
  app.use(helmet());

  // Response compression
  app.use(compression());

  // CORS — whitelist FRONTEND_URL, allow credentials
  app.enableCors({
    origin: configService.get('FRONTEND_URL'),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());


  // Swagger
  const config = new DocumentBuilder()
    .setTitle('HubAssist API')
    .setDescription('A comprehensive coworking and workspace management system powered by Stellar')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(3001);
  logger.log('HubAssist API running on http://localhost:3001');
  logger.log('Swagger UI available at http://localhost:3001/api/docs');
}
bootstrap();
