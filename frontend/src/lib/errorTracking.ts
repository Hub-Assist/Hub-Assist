export interface ErrorReportContext {
  error: Error;
  componentStack: string;
  section?: string;
}

/**
 * Stub for future Sentry (or similar) integration.
 * Centralizes error reporting so ErrorBoundary callers don't need to know
 * which tracking service is wired up.
 */
export function reportError({ error, componentStack, section }: ErrorReportContext): void {
  console.error(`[ErrorBoundary${section ? `:${section}` : ""}]`, error, componentStack);
}
