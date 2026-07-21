import { Transform } from 'class-transformer';

/**
 * Per-field sanitization decorator (class-transformer).
 * Trims whitespace, strips HTML tags, and normalizes unicode (NFC).
 * Use @NoSanitize() instead when a field must bypass all sanitization.
 */
export function SanitizeString() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    return sanitizeStringValue(value);
  });
}

/**
 * Core sanitization logic shared between the decorator and the global pipe.
 * 1. Trim leading/trailing whitespace
 * 2. Strip HTML tags (prevents XSS payloads)
 * 3. Normalize unicode to NFC (prevents homoglyph / injection tricks)
 */
export function sanitizeStringValue(value: string): string {
  // Trim whitespace
  let sanitized = value.trim();
  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  // Normalize unicode to NFC
  sanitized = sanitized.normalize('NFC');
  return sanitized;
}
