/**
 * Cursor-based pagination utilities.
 *
 * The cursor encodes a (timestamp, id) tuple so that records with identical
 * timestamps are still ordered deterministically by their UUID primary key.
 * The encoded string is base64url (URL-safe, no padding) so it can be passed
 * directly as a query parameter without percent-encoding.
 */

export interface CursorPayload {
  /** ISO-8601 timestamp of the last record on the current page */
  timestamp: string;
  /** UUID of the last record on the current page */
  id: string;
}

/**
 * Encode a (timestamp, id) pair into an opaque, URL-safe cursor token.
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  // Convert to base64url: replace +→-, /→_, strip trailing =
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode an opaque cursor token back into a (timestamp, id) pair.
 *
 * @throws {Error} if the token is malformed or missing required fields.
 */
export function decodeCursor(cursor: string): CursorPayload {
  // Restore base64 padding and standard characters
  const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    throw new Error(`Invalid cursor token: cannot decode`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).timestamp !== 'string' ||
    typeof (parsed as Record<string, unknown>).id !== 'string'
  ) {
    throw new Error(`Invalid cursor token: missing required fields`);
  }

  return parsed as CursorPayload;
}
