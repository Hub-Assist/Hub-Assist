// Well-known "null" Stellar account (raw ed25519 key of all zero bytes,
// re-encoded with a valid StrKey checksum). It is never funded and never
// signs anything — it exists only to serve as the transaction `source`
// account when simulating a read-only contract call (simulateTransaction
// does not execute on-chain or require a real signer/sequence number), so
// no real account needs to be provisioned just to read contract state.
export const STELLAR_SIMULATION_ACCOUNT =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
