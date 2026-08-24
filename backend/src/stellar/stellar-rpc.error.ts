/**
 * Thrown when an outbound Stellar RPC call still fails after every retry
 * attempt has been exhausted. Carries the last underlying error as `cause`
 * so callers get a typed, predictable rejection instead of whatever the
 * SDK/network happened to throw on the final attempt.
 */
export class StellarRpcError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly attempts: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StellarRpcError';
  }
}
