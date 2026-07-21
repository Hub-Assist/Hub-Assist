import { encodeCursor, decodeCursor, CursorPayload } from './cursor.util';

describe('cursor utilities', () => {
  const sample: CursorPayload = {
    timestamp: '2024-06-15T12:34:56.789Z',
    id: '550e8400-e29b-41d4-a716-446655440000',
  };

  describe('encodeCursor', () => {
    it('returns a non-empty string', () => {
      expect(encodeCursor(sample)).toBeTruthy();
    });

    it('produces a URL-safe token (no +, /, or = characters)', () => {
      const token = encodeCursor(sample);
      expect(token).not.toMatch(/[+/=]/);
    });

    it('is deterministic — same input always yields the same token', () => {
      expect(encodeCursor(sample)).toBe(encodeCursor(sample));
    });
  });

  describe('decodeCursor', () => {
    it('round-trips losslessly', () => {
      const token = encodeCursor(sample);
      const decoded = decodeCursor(token);
      expect(decoded.timestamp).toBe(sample.timestamp);
      expect(decoded.id).toBe(sample.id);
    });

    it('throws on a completely invalid token', () => {
      expect(() => decodeCursor('not-valid-base64!!!')).toThrow();
    });

    it('throws when the decoded JSON is missing the timestamp field', () => {
      const bad = Buffer.from(JSON.stringify({ id: 'abc' }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      expect(() => decodeCursor(bad)).toThrow('Invalid cursor token: missing required fields');
    });

    it('throws when the decoded JSON is missing the id field', () => {
      const bad = Buffer.from(JSON.stringify({ timestamp: '2024-01-01T00:00:00.000Z' }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      expect(() => decodeCursor(bad)).toThrow('Invalid cursor token: missing required fields');
    });

    it('throws when the token is valid base64 but not JSON', () => {
      const bad = Buffer.from('this is not json')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      expect(() => decodeCursor(bad)).toThrow('Invalid cursor token: cannot decode');
    });
  });

  describe('boundary conditions', () => {
    it('handles timestamps with identical seconds (sub-millisecond precision preserved)', () => {
      const a: CursorPayload = { timestamp: '2024-01-01T00:00:00.000Z', id: 'aaa' };
      const b: CursorPayload = { timestamp: '2024-01-01T00:00:00.000Z', id: 'bbb' };
      expect(decodeCursor(encodeCursor(a))).toEqual(a);
      expect(decodeCursor(encodeCursor(b))).toEqual(b);
      // Different ids must produce different tokens
      expect(encodeCursor(a)).not.toBe(encodeCursor(b));
    });

    it('handles the very first record (epoch-like timestamp)', () => {
      const first: CursorPayload = {
        timestamp: '1970-01-01T00:00:00.000Z',
        id: '00000000-0000-0000-0000-000000000000',
      };
      expect(decodeCursor(encodeCursor(first))).toEqual(first);
    });

    it('handles a far-future timestamp', () => {
      const future: CursorPayload = {
        timestamp: '9999-12-31T23:59:59.999Z',
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      };
      expect(decodeCursor(encodeCursor(future))).toEqual(future);
    });
  });
});
