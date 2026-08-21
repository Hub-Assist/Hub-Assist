import type { BrowserContext, Page } from "@playwright/test";

const PORT = Number(process.env.PORT) || 3000;

/** Origin the Next.js app itself is served from — used to scope the auth cookie. */
export const FRONTEND_ORIGIN = `http://localhost:${PORT}`;

function base64url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds a JWT-shaped (but unsigned) token. `middleware.ts` only ever base64-decodes
 * the payload to read `exp`/`role` — it never verifies the signature client-side —
 * so this is sufficient to drive the real redirect/role-gating logic in e2e specs.
 */
export function buildFakeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.e2e-mock-signature`;
}

export type MockRole = "admin" | "member" | "staff";

export interface MockUser {
  id: string;
  firstname: string;
  lastname: string;
  name: string;
  email: string;
  role: MockRole;
  verified: boolean;
  active: boolean;
  joinedDate: string;
  createdAt: string;
  updatedAt: string;
  stellarPublicKey?: string;
}

export function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  const base: MockUser = {
    id: "user-1",
    firstname: "Jordan",
    lastname: "Reyes",
    name: "Jordan Reyes",
    email: "jordan.reyes@example.com",
    role: "member",
    verified: true,
    active: true,
    joinedDate: "2026-01-15T00:00:00.000Z",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };
  return { ...base, ...overrides };
}

/**
 * Seeds a fully authenticated session before the app's first script runs:
 *  - the `token` cookie `middleware.ts` reads for route protection/role gating
 *  - the zustand `auth-storage` persisted state the app reads for `user`/`accessToken`
 *
 * Call this before `page.goto(...)` — it front-loads the cookie via the browser
 * context and installs an init script for localStorage.
 */
export async function seedAuth(
  context: BrowserContext,
  page: Page,
  user: MockUser,
  options: { expiresInSeconds?: number } = {},
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600);
  const token = buildFakeJwt({ sub: user.id, role: user.role, exp });

  await context.addCookies([
    { name: "token", value: token, domain: "localhost", path: "/" },
  ]);

  await page.addInitScript(
    ({ token: t, user: u }) => {
      window.localStorage.setItem(
        "auth-storage",
        JSON.stringify({ state: { accessToken: t, user: u }, version: 0 }),
      );
    },
    { token, user },
  );

  return token;
}
