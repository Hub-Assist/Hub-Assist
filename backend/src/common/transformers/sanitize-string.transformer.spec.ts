import { plainToInstance } from 'class-transformer';
import { IsString } from 'class-validator';
import { SanitizeString, sanitizeStringValue } from './sanitize-string.transformer';

class TestDto {
  @SanitizeString()
  @IsString()
  text!: string;
}

describe('SanitizeString Transformer (decorator)', () => {
  it('should strip HTML tags', () => {
    const input = { text: '<script>alert("xss")</script>Hello' };
    const result = plainToInstance(TestDto, input);
    expect(result.text).toBe('alert("xss")Hello');
  });

  it('should trim whitespace', () => {
    const input = { text: '  Hello World  ' };
    const result = plainToInstance(TestDto, input);
    expect(result.text).toBe('Hello World');
  });

  it('should handle combined HTML and whitespace', () => {
    const input = { text: '  <div>  Test  </div>  ' };
    const result = plainToInstance(TestDto, input);
    expect(result.text).toBe('Test');
  });

  it('should return non-string values unchanged', () => {
    const input = { text: 123 };
    const result = plainToInstance(TestDto, input);
    expect(result.text).toBe(123);
  });

  it('should normalize unicode to NFC', () => {
    const nfd = '\u0065\u0301'; // NFD é
    const nfc = '\u00E9';       // NFC é
    const input = { text: nfd };
    const result = plainToInstance(TestDto, input);
    expect(result.text).toBe(nfc);
  });
});

describe('sanitizeStringValue (utility function)', () => {
  it('trims whitespace', () => {
    expect(sanitizeStringValue('  hello  ')).toBe('hello');
  });

  it('strips HTML tags', () => {
    expect(sanitizeStringValue('<b>bold</b>')).toBe('bold');
  });

  it('strips self-closing tags', () => {
    expect(sanitizeStringValue('<img src=x />')).toBe('');
  });

  it('normalizes unicode NFC', () => {
    expect(sanitizeStringValue('\u0065\u0301')).toBe('\u00E9');
  });

  it('returns empty string for tag-only input', () => {
    expect(sanitizeStringValue('<script></script>')).toBe('');
  });

  it('does not alter plain text', () => {
    expect(sanitizeStringValue('hello world')).toBe('hello world');
  });
});
