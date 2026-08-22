import { decodeToken, hasRequiredRole, isTokenExpired } from "@/lib/auth/decodeToken";

/** Builds a JWT-shaped string (unsigned) from a plain payload object. */
function makeToken(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "none" }): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=+$/, "");
  return `${b64(header)}.${b64(payload)}.signature`;
}

describe("decodeToken", () => {
  it("decodes a well-formed token's payload", () => {
    const token = makeToken({ sub: "user-1", role: "admin", exp: 9999999999 });
    expect(decodeToken(token)).toMatchObject({ sub: "user-1", role: "admin", exp: 9999999999 });
  });

  it("returns null for a token with a missing payload segment", () => {
    expect(decodeToken("onlyheader")).toBeNull();
  });

  it("returns null for a payload segment that isn't valid base64/JSON", () => {
    expect(decodeToken("header.not-valid-json!!!.sig")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(decodeToken("")).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("is false for a token with a future exp", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("is true for a token with a past exp", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("is true for a token with no exp claim", () => {
    const token = makeToken({ sub: "user-1" });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("is true for a malformed token", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });
});

describe("hasRequiredRole", () => {
  it("grants access when no role is required", () => {
    expect(hasRequiredRole(null, null)).toBe(true);
    expect(hasRequiredRole({ role: "member" }, undefined)).toBe(true);
  });

  it("denies access when a role is required but the payload is null", () => {
    expect(hasRequiredRole(null, "admin")).toBe(false);
  });

  it("matches a single required role against a single held role", () => {
    expect(hasRequiredRole({ role: "admin" }, "admin")).toBe(true);
    expect(hasRequiredRole({ role: "member" }, "admin")).toBe(false);
  });

  it("matches when the held role is one of several required roles", () => {
    expect(hasRequiredRole({ role: "staff" }, ["admin", "staff"])).toBe(true);
    expect(hasRequiredRole({ role: "member" }, ["admin", "staff"])).toBe(false);
  });

  it("matches when the token holds an array of roles", () => {
    expect(hasRequiredRole({ role: ["member", "staff"] }, "staff")).toBe(true);
    expect(hasRequiredRole({ role: ["member", "staff"] }, "admin")).toBe(false);
  });

  it("matches when both required and held roles are arrays", () => {
    expect(hasRequiredRole({ role: ["member", "staff"] }, ["admin", "staff"])).toBe(true);
  });

  it("denies access when the payload has no role claim", () => {
    expect(hasRequiredRole({ sub: "user-1" }, "admin")).toBe(false);
  });
});
