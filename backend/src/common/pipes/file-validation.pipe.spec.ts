import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

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

  beforeEach(() => {
    pipe = new FileValidationPipe();
  });

  it('should pass a valid jpeg file', () => {
    const file = makeFile();
    expect(pipe.transform(file)).toBe(file);
  });

  it('should pass a valid png file', () => {
    const file = makeFile({ mimetype: 'image/png', originalname: 'test.png' });
    expect(pipe.transform(file)).toBe(file);
  });

  it('should pass a valid webp file', () => {
    const file = makeFile({ mimetype: 'image/webp', originalname: 'test.webp' });
    expect(pipe.transform(file)).toBe(file);
  });

  it('should throw BadRequestException when no file is provided', () => {
    expect(() => pipe.transform(undefined as any)).toThrow(BadRequestException);
    expect(() => pipe.transform(undefined as any)).toThrow('No file provided');
  });

  it('should throw BadRequestException when file exceeds 5 MB', () => {
    const file = makeFile({ size: 6 * 1024 * 1024 });
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('File size exceeds the 5 MB limit');
  });

  it('should throw BadRequestException for disallowed MIME type', () => {
    const file = makeFile({ mimetype: 'image/gif', originalname: 'test.gif' });
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('Invalid file type');
  });

  it('should throw BadRequestException for non-image MIME type', () => {
    const file = makeFile({ mimetype: 'application/pdf', originalname: 'test.pdf' });
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });
});
