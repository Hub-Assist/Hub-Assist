import { Injectable, PipeTransform, BadRequestException, PayloadTooLargeException, Logger, ArgumentMetadata } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { AuditLogService } from '../../audit/audit-log.service';

/**
 * FileValidationPipe performs deep MIME type inspection using magic bytes
 * instead of trusting the Content-Type header, preventing disguised file uploads.
 * 
 * Supported MIME types (verified via magic bytes):
 * - image/jpeg
 * - image/png
 * - image/webp
 * 
 * Maximum file size: 5 MB
 * 
 * The pipe also sanitizes filenames to remove path traversal characters and
 * logs rejected upload attempts to the audit log for security monitoring.
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly logger = new Logger(FileValidationPipe.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  async transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size first (fail fast)
    if (file.size > this.MAX_FILE_SIZE) {
      this.logRejectedUpload(file, 'FILE_SIZE_EXCEEDED', file.size, null);
      throw new PayloadTooLargeException('File size exceeds the 5 MB limit');
    }

    // Perform deep MIME type inspection using magic bytes
    const detectedType = await fileTypeFromBuffer(file.buffer);
    
    if (!detectedType) {
      this.logRejectedUpload(file, 'UNDETECTABLE_FILE_TYPE', file.size, null);
      throw new BadRequestException(
        'Unable to determine file type. File may be corrupted or unsupported.',
      );
    }

    const detectedMime = detectedType.mime;
    
    if (!this.ALLOWED_MIME_TYPES.includes(detectedMime)) {
      this.logRejectedUpload(file, 'INVALID_MIME_TYPE', file.size, detectedMime);
      throw new BadRequestException(
        `Invalid file type. Detected: ${detectedMime}. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Sanitize filename to remove path traversal characters
    file.originalname = this.sanitizeFilename(file.originalname);

    return file;
  }

  private sanitizeFilename(filename: string): string {
    // Remove path traversal characters and normalize
    return filename
      .replace(/[\/\\]/g, '') // Remove path separators
      .replace(/\.\./g, '') // Remove directory traversal attempts
      .replace(/^\.+/, '') // Remove leading dots (hidden files)
      .trim();
  }

  private logRejectedUpload(file: Express.Multer.File, eventType: string, fileSize: number, detectedMime: string | null): void {
    this.logger.warn(
      `File upload rejected: ${eventType} - Original name: ${file.originalname}, Size: ${fileSize}, Detected MIME: ${detectedMime || 'unknown'}`,
    );

    // Log to audit log for security monitoring
    this.auditLogService.log({
      eventType,
      resourceType: 'file_upload',
      resourceId: file.originalname,
      before: {
        originalFilename: file.originalname,
        fileSize,
        declaredMimeType: file.mimetype,
        detectedMimeType: detectedMime,
      },
    });
  }
}
