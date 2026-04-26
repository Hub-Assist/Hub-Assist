import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, url, ip } = req;

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const { statusCode } = res;

      this.logger.log(
        `${method} ${url} - Status: ${statusCode} - Response Time: ${responseTime}ms - IP: ${ip}`,
      );
    });

    next();
  }
}
