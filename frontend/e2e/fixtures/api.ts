import type { Page, Route } from "@playwright/test";
import { FRONTEND_ORIGIN } from "./auth";

/**
 * The backend origin/base-path (`NEXT_PUBLIC_API_URL`) differs between local dev
 * (`http://localhost:3001/api/v1`, from `src/utils/env.ts`'s fallback) and the CI
 * production build (`.env.production`'s `https://api.hubassist.com/api`). Specs
 * intercept by *pathname* rather than hard-coding an origin so they stay correct
 * either way, and so a mocked test can never leak a real request to the
 * production API.
 */
export async function routeApi(
  page: Page,
  matcher: RegExp,
  handler: (route: Route) => Promise<void> | void,
): Promise<void> {
  // Scoping to non-frontend origins too matters: a backend path like `/workspaces`
  // can share a path *tail* with one of the Next.js app's own page routes (also
  // `/workspaces`), and a bare pathname regex would otherwise hijack that page's
  // own navigation request as well as the API call it's meant to stub.
  await page.route((url) => url.origin !== FRONTEND_ORIGIN && matcher.test(url.pathname), handler);
}

/** Wraps a payload in the `{ success, data, timestamp }` envelope `apiClient` unwraps. */
export function envelope(data: unknown) {
  return { success: true, data, timestamp: new Date(0).toISOString() };
}

export function jsonRoute(data: unknown, status = 200) {
  return (route: Route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(envelope(data)),
    });
}

export function errorRoute(status: number, message: string) {
  return (route: Route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message, statusCode: status }),
    });
}

/**
 * Safety net: aborts any request that isn't the Next.js app itself (i.e. any
 * backend API call) unless a more specific `page.route` registered afterwards
 * claims it first. Playwright resolves routes last-registered-first, so specs
 * should call this once up front, then layer specific mocks on top.
 *
 * Without this, an endpoint a spec forgot to mock would silently fall through
 * to a real network call — against `https://api.hubassist.com` in CI — instead
 * of failing loudly inside the test.
 */
export async function installApiGuard(page: Page): Promise<void> {
  await page.route(
    (url) => url.origin !== FRONTEND_ORIGIN,
    (route) =>
      route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: `Unmocked e2e request: ${route.request().method()} ${route.request().url()}`,
        }),
      }),
  );
}

/**
 * Stubs the handful of read-only endpoints `DashboardContent` fires on every
 * `/dashboard` visit (stats, activity, growth, analytics) with empty-but-valid
 * payloads, so dashboard-adjacent specs land on a clean render instead of a
 * wall of per-widget error states and query retries.
 */
export async function mockDashboardWidgets(page: Page): Promise<void> {
  await routeApi(page, /\/dashboard\/stats$/, jsonRoute({
    totalMembers: 0, verifiedMembers: 0, activeWorkspaces: 0, deskOccupancy: 0,
  }));
  await routeApi(page, /\/dashboard\/activity$/, jsonRoute([]));
  await routeApi(page, /\/dashboard\/growth$/, jsonRoute([]));
  await routeApi(page, /\/dashboard\/admin-stats$/, jsonRoute({}));
  await routeApi(page, /\/analytics\/member-growth$/, jsonRoute([]));
  await routeApi(page, /\/analytics\/booking-revenue$/, jsonRoute([]));
  await routeApi(page, /\/analytics\/workspace-utilization$/, jsonRoute([]));
  await routeApi(page, /\/analytics\/attendance-patterns$/, jsonRoute({ peakHours: [], dayOfWeekPatterns: [] }));
}
