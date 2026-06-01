import { BadRequestException, PayloadTooLargeException, ArgumentMetadata } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';
import { AuditLogService } from '../../audit/audit-log.service';
import { Test } from '@nestjs/testing';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;
  let auditLogService: AuditLogService;

  // JPEG magic bytes (FF D8 FF)
  const jpegMagicBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  
  // PNG magic bytes with complete IHDR chunk
  const pngMagicBytes = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length (13 bytes)
    0x49, 0x48, 0x44, 0x52, // IHDR chunk type
    0x00, 0x00, 0x00, 0x01, // Width (1)
    0x00, 0x00, 0x00, 0x01, // Height (1)
    0x08, // Bit depth (8)
    0x06, // Color type (RGBA)
    0x00, // Compression method
    0x00, // Filter method
    0x00, // Interlace method
    0x00, 0x00, 0x00, 0x00, // CRC (placeholder)
  ]);
  
  // WebP magic bytes (52 49 46 46 ... 57 45 42 50)
  const webpMagicBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  
  // PHP file content (disguised as .jpg)
  const phpContent = Buffer.from('<?php echo "malicious"; ?>');

  const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '',
    filename: 'test.jpg',
    path: '',
    buffer: Buffer.from(''),
    stream: null as any,
    ...overrides,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FileValidationPipe,
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    pipe = module.get<FileValidationPipe>(FileValidationPipe);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should pass a valid 2MB JPEG file', async () => {
    const file = makeFile({
      buffer: jpegMagicBytes,
      size: 2 * 1024 * 1024, // 2MB
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    const result = await pipe.transform(file, metadata);
    expect(result).toBe(file);
    expect(result.originalname).toBe('test.jpg');
  });

  it('should pass a valid PNG file', async () => {
    const file = makeFile({
      buffer: pngMagicBytes,
      originalname: 'test.png',
      mimetype: 'image/png',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    const result = await pipe.transform(file, metadata);
    expect(result).toBe(file);
    expect(result.originalname).toBe('test.png');
  });

  it('should pass a valid WebP file', async () => {
    const file = makeFile({
      buffer: webpMagicBytes,
      originalname: 'test.webp',
      mimetype: 'image/webp',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    const result = await pipe.transform(file, metadata);
    expect(result).toBe(file);
    expect(result.originalname).toBe('test.webp');
  });

  it('should throw BadRequestException when no file is provided', async () => {
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    await expect(pipe.transform(undefined as any, metadata))
      .rejects.toThrow(BadRequestException);
    await expect(pipe.transform(undefined as any, metadata))
      .rejects.toThrow('No file provided');
  });

  it('should throw PayloadTooLargeException when file exceeds 5 MB', async () => {
    const file = makeFile({
      buffer: pngMagicBytes,
      size: 6 * 1024 * 1024, // 6MB
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    await expect(pipe.transform(file, metadata))
      .rejects.toThrow(PayloadTooLargeException);
    await expect(pipe.transform(file, metadata))
      .rejects.toThrow('File size exceeds the 5 MB limit');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'FILE_SIZE_EXCEEDED',
        resourceType: 'file_upload',
      }),
    );
  });

  it('should reject PHP file renamed to .jpg at MIME detection step', async () => {
    const file = makeFile({
      buffer: phpContent,
      originalname: 'test.php.jpg',
      mimetype: 'image/jpeg', // Attacker-controlled Content-Type header
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    await expect(pipe.transform(file, metadata))
      .rejects.toThrow(BadRequestException);
    await expect(pipe.transform(file, metadata))
      .rejects.toThrow('Unable to determine file type');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'UNDETECTABLE_FILE_TYPE',
        resourceType: 'file_upload',
      }),
    );
  });

  it('should reject GIF file (not in allowlist)', async () => {
    // GIF magic bytes (47 49 46 38)
    const gifMagicBytes = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const file = makeFile({
      buffer: gifMagicBytes,
      originalname: 'test.gif',
      mimetype: 'image/gif',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    await expect(pipe.transform(file, metadata))
      .rejects.toThrow(BadRequestException);
    await expect(pipe.transform(file, metadata))
      .rejects.toThrow('Invalid file type');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'INVALID_MIME_TYPE',
        resourceType: 'file_upload',
      }),
    );
  });

  it('should sanitize filename with path traversal characters', async () => {
    const file = makeFile({
      buffer: jpegMagicBytes,
      originalname: '../../../etc/passwd.jpg',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    const result = await pipe.transform(file, metadata);
    expect(result.originalname).toBe('etcpasswd.jpg');
  });

  it('should sanitize filename with backslashes', async () => {
    const file = makeFile({
      buffer: jpegMagicBytes,
      originalname: '..\\..\\windows\\system32\\test.jpg',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    const result = await pipe.transform(file, metadata);
    expect(result.originalname).toBe('windowssystem32test.jpg');
  });

  it('should sanitize filename with leading dots', async () => {
    const file = makeFile({
      buffer: jpegMagicBytes,
      originalname: '.hidden.jpg',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    const result = await pipe.transform(file, metadata);
    expect(result.originalname).toBe('hidden.jpg');
  });

  it('should log rejected upload attempts to audit log', async () => {
    const file = makeFile({
      buffer: phpContent,
      originalname: 'malicious.php.jpg',
      mimetype: 'image/jpeg',
    });
    const metadata: ArgumentMetadata = { type: 'custom', metatype: null, data: null };
    try {
      await pipe.transform(file, metadata);
    } catch (e) {
      // Expected to throw
    }
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'UNDETECTABLE_FILE_TYPE',
        resourceType: 'file_upload',
        resourceId: 'malicious.php.jpg',
        before: expect.objectContaining({
          originalFilename: 'malicious.php.jpg',
          declaredMimeType: 'image/jpeg',
        }),
      }),
    );
  });
});
