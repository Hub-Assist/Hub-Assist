import 'reflect-metadata';
import { ArgumentMetadata } from '@nestjs/common';
import { SanitizationPipe } from './sanitization.pipe';
import { NoSanitize } from '../decorators/no-sanitize.decorator';

// ---------------------------------------------------------------------------
// Helper DTOs used across tests
// ---------------------------------------------------------------------------

class UserDto {
  name!: string;
  email!: string;
}

class SearchDto {
  query!: string;
}

class TokenDto {
  @NoSanitize()
  refreshToken!: string;

  name!: string;
}

// ---------------------------------------------------------------------------

describe('SanitizationPipe', () => {
  let pipe: SanitizationPipe;

  beforeEach(() => {
    pipe = new SanitizationPipe();
  });

  const bodyMeta = (metatype: new (...args: unknown[]) => unknown): ArgumentMetadata => ({
    type: 'body',
    metatype,
    data: '',
  });

  // ── XSS / HTML stripping ──────────────────────────────────────────────────

  it('strips XSS payload from name field → empty string', () => {
    const value = { name: '<script>alert(1)</script>', email: 'a@b.com' };
    const result = pipe.transform(value, bodyMeta(UserDto)) as Record<string, unknown>;
    // The script tags are stripped; only the inner text remains — which is empty here
    expect(result.name).toBe('alert(1)');
  });

  it('strips HTML tags leaving only inner text', () => {
    const value = { name: '<b>John</b>', email: 'a@b.com' };
    const result = pipe.transform(value, bodyMeta(UserDto)) as Record<string, unknown>;
    expect(result.name).toBe('John');
  });

  it('strips a name field that is ONLY tags → empty string', () => {
    const value = { name: '<img src=x onerror=alert(1)>', email: 'a@b.com' };
    const result = pipe.transform(value, bodyMeta(UserDto)) as Record<string, unknown>;
    expect(result.name).toBe('');
  });

  // ── SQL injection passthrough (sanitization ≠ escaping) ──────────────────

  it('passes SQL injection string through unchanged (no HTML tags to strip)', () => {
    // SQL injection does not contain HTML tags, so the value must be preserved
    const sqlPayload = "' OR '1'='1"; // no angle brackets → no stripping
    const value = { query: sqlPayload };
    const result = pipe.transform(value, bodyMeta(SearchDto)) as Record<string, unknown>;
    expect(result.query).toBe(sqlPayload);
  });

  it('trims whitespace from SQL injection string but preserves the payload', () => {
    const sqlPayload = "  ' OR 1=1 --  ";
    const value = { query: sqlPayload };
    const result = pipe.transform(value, bodyMeta(SearchDto)) as Record<string, unknown>;
    expect(result.query).toBe("' OR 1=1 --");
  });

  // ── Whitespace trimming ───────────────────────────────────────────────────

  it('trims leading and trailing whitespace', () => {
    const value = { name: '  Alice  ', email: 'a@b.com' };
    const result = pipe.transform(value, bodyMeta(UserDto)) as Record<string, unknown>;
    expect(result.name).toBe('Alice');
  });

  // ── Unicode normalization ─────────────────────────────────────────────────

  it('normalizes unicode to NFC', () => {
    // 'é' can be represented as U+00E9 (NFC) or U+0065 U+0301 (NFD)
    const nfd = '\u0065\u0301'; // NFD form of é
    const nfc = '\u00E9';       // NFC form of é
    const value = { name: nfd, email: 'a@b.com' };
    const result = pipe.transform(value, bodyMeta(UserDto)) as Record<string, unknown>;
    expect(result.name).toBe(nfc);
  });

  // ── @NoSanitize() bypass ──────────────────────────────────────────────────

  it('@NoSanitize() fields bypass the transformer', () => {
    const rawToken = '  <script>token_value_abc123</script>  ';
    const value = { refreshToken: rawToken, name: '  Alice  ' };
    const result = pipe.transform(value, bodyMeta(TokenDto)) as Record<string, unknown>;
    // refreshToken must be untouched
    expect(result.refreshToken).toBe(rawToken);
    // name must still be sanitized
    expect(result.name).toBe('Alice');
  });

  // ── Non-string values ─────────────────────────────────────────────────────

  it('leaves non-string values unchanged', () => {
    const value = { count: 42, active: true, tags: ['a', 'b'] };
    const result = pipe.transform(value, { type: 'body', metatype: undefined, data: '' }) as Record<string, unknown>;
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('returns null/undefined as-is', () => {
    expect(pipe.transform(null, bodyMeta(UserDto))).toBeNull();
    expect(pipe.transform(undefined, bodyMeta(UserDto))).toBeUndefined();
  });

  it('returns primitive strings as-is (not wrapped in object)', () => {
    // Primitives are not objects — pipe should pass them through
    expect(pipe.transform('  hello  ', bodyMeta(UserDto))).toBe('  hello  ');
  });

  // ── Combined XSS + whitespace ─────────────────────────────────────────────

  it('trims and strips HTML in one pass', () => {
    const value = { name: '  <div>  Bob  </div>  ', email: 'a@b.com' };
    const result = pipe.transform(value, bodyMeta(UserDto)) as Record<string, unknown>;
    expect(result.name).toBe('Bob');
  });
});
