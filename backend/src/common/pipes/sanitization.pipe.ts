import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  Logger,
} from '@nestjs/common';
import 'reflect-metadata';
import { NO_SANITIZE_KEY } from '../decorators/no-sanitize.decorator';
import { sanitizeStringValue } from '../transformers/sanitize-string.transformer';

/**
 * Global sanitization pipe — runs BEFORE the ValidationPipe.
 *
 * For every incoming DTO body/query/param:
 *  - Iterates all string properties
 *  - Trims whitespace, strips HTML tags, normalizes unicode (NFC)
 *  - Skips properties decorated with @NoSanitize()
 *  - Logs a WARN when a value was actually changed (field name + truncated original)
 *
 * Register in main.ts BEFORE ValidationPipe:
 *   app.useGlobalPipes(new SanitizationPipe(), new ValidationPipe(...))
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  private readonly logger = new Logger(SanitizationPipe.name);

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only process body / query / param objects; skip raw primitives and files
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return value;
    }

    // Resolve the DTO constructor so we can read its metadata
    const metatype = metadata.metatype;

    return this.sanitizeObject(value as Record<string, unknown>, metatype);
  }

  private sanitizeObject(
    obj: Record<string, unknown>,
    metatype?: new (...args: unknown[]) => unknown,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = { ...obj };

    for (const key of Object.keys(sanitized)) {
      const fieldValue = sanitized[key];

      // Recursively handle nested plain objects
      if (
        fieldValue !== null &&
        typeof fieldValue === 'object' &&
        !Array.isArray(fieldValue)
      ) {
        sanitized[key] = this.sanitizeObject(
          fieldValue as Record<string, unknown>,
        );
        continue;
      }

      if (typeof fieldValue !== 'string') {
        continue;
      }

      // Check @NoSanitize() metadata on the DTO class property
      if (metatype && this.isNoSanitize(metatype, key)) {
        continue;
      }

      const cleaned = sanitizeStringValue(fieldValue);

      if (cleaned !== fieldValue) {
        // Log at warn level: field name + first 80 chars of original value
        const truncated =
          fieldValue.length > 80
            ? `${fieldValue.slice(0, 80)}…`
            : fieldValue;
        this.logger.warn(
          `Sanitized field "${key}": original value truncated → "${truncated}"`,
        );
        sanitized[key] = cleaned;
      }
    }

    return sanitized;
  }

  /**
   * Returns true when the property has been decorated with @NoSanitize().
   * The decorator uses Reflect.defineMetadata on the class prototype.
   */
  private isNoSanitize(
    metatype: new (...args: unknown[]) => unknown,
    propertyKey: string,
  ): boolean {
    return Reflect.getMetadata(NO_SANITIZE_KEY, metatype.prototype, propertyKey) === true;
  }
}
