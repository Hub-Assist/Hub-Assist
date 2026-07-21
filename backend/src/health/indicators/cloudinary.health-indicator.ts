import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      return this.getStatus(key, true, {
        status: 'skipped',
        reason: 'Cloudinary credentials not configured',
      });
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloudinary ping timed out after 5s')), 5000),
    );

    try {
      // ping() calls GET /ping on the Cloudinary API — lightweight, no quota cost
      const result = await Promise.race([
        cloudinary.api.ping() as Promise<{ status: string }>,
        timeoutPromise,
      ]);

      const isUp = result?.status === 'ok';

      if (!isUp) {
        throw new HealthCheckError(
          `Cloudinary ping returned unexpected status: ${result?.status}`,
          this.getStatus(key, false, { status: 'down', response: result }),
        );
      }

      return this.getStatus(key, true, { status: 'up', cloudName });
    } catch (err) {
      if (err instanceof HealthCheckError) throw err;

      throw new HealthCheckError(
        `Cloudinary health check failed: ${(err as Error).message}`,
        this.getStatus(key, false, {
          status: 'down',
          error: (err as Error).message,
          cloudName,
        }),
      );
    }
  }
}
