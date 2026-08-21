/**
 * Calculate the next retry timestamp using exponential backoff
 * Formula: delay = 2^(attempts-1) seconds, capped at reasonable limits
 * @param attempts - Number of attempts made so far
 * @param now - Current timestamp (defaults to now)
 * @returns Date object for the next retry
 */
export function calculateNextRetryAt(attempts: number, now = new Date()): Date {
  const delaySeconds = 2 ** Math.max(attempts - 1, 0);
  return new Date(now.getTime() + delaySeconds * 1000);
}

/**
 * Check if an item should be considered dead (exceeded max retries)
 * @param attempts - Number of attempts made
 * @param maxAttempts - Maximum allowed attempts
 * @returns true if max retries exceeded
 */
export function isDeadLetter(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}
