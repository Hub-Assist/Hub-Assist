import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public error?: string,
    public details?: any[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorResponseSchema {
  success: boolean;
  statusCode: number;
  error: string;
  message: string;
  details?: any[];
  requestId?: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).id;

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let error: string = 'InternalServerError';
    let details: any[] = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.constructor.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as any;
        message = res.message || exception.message;
        error = res.error || exception.constructor.name;

        // Extract validation errors from BadRequestException
        if (exception instanceof BadRequestException && res.message && Array.isArray(res.message)) {
          details = res.message.map((msg: any) => ({
            field: msg.property || 'unknown',
            message: msg.constraints ? Object.values(msg.constraints)[0] : msg,
          }));
        }
      } else {
        message = exception.message;
        error = exception.constructor.name;
      }

      this.logger.warn(`HTTP Exception [${statusCode}]: ${message}`, {
        error,
        path: request.url,
        requestId,
      });
    } else if (exception instanceof QueryFailedError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Database query failed';
      error = 'QueryFailedError';

      this.logger.error(`Database Error: ${exception.message}`, {
        path: request.url,
        requestId,
      });
    } else if (exception instanceof ApiError) {
      statusCode = exception.statusCode;
      message = exception.message;
      error = exception.error || 'ApiError';
      details = exception.details || [];

      if (statusCode >= 500) {
        this.logger.error(`API Error [${statusCode}]: ${message}`, {
          error,
          path: request.url,
          requestId,
        });
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = exception.constructor.name;

      this.logger.error(`Unhandled Exception: ${exception.message}`, {
        stack: exception.stack,
        path: request.url,
        requestId,
      });
    } else {
      this.logger.error(`Unknown Exception: ${JSON.stringify(exception)}`, {
        path: request.url,
        requestId,
      });
    }

    // Build normalized error response
    const errorResponse: ErrorResponseSchema = {
      success: false,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    };

    // Only include details for 4xx errors
    if (statusCode < 500 && details.length > 0) {
      errorResponse.details = details;
    }

    response.status(statusCode).json(errorResponse);
  }
}