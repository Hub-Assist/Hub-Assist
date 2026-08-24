/**
 * Shared, typed JWT payload decoding.
 *
 * This performs **no signature verification** — it only base64url-decodes
 * the payload segment. It's meant for lightweight, non-authoritative checks
 * (e.g. route gating in `middleware.ts`, or reading a claim client-side for
 * display). The server remains the source of truth for authorization.
 */

export interface DecodedToken {
  /** Expiry, in seconds since the Unix epoch (standard JWT `exp` claim). */
  exp?: number;
  /** One role, or the set of roles, held by the token's subject. */
  role?: string | string[];
  [claim: string]: unknown;
}

/**
 * Decodes a JWT's payload segment. Returns `null` if `token` is malformed
 * or its payload isn't valid JSON.
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;

    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * True if `token` is malformed, has no `exp` claim, or its `exp` is in the past.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() >= payload.exp * 1000;
}

/**
 * Checks a decoded token's `role` claim against `requiredRole`.
 *
 * Both sides may be a single role or an array of roles — access is granted
 * if any held role matches any required role. `requiredRole` of `null` /
 * `undefined` means the route has no role restriction.
 */
export function hasRequiredRole(
  payload: DecodedToken | null,
  requiredRole: string | string[] | null | undefined
): boolean {
  if (!requiredRole) return true;
  if (!payload?.role) return false;

  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const held = Array.isArray(payload.role) ? payload.role : [payload.role];

  return required.some((role) => held.includes(role));
}
