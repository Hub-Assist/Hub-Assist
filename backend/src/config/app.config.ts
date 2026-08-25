import { registerAs } from '@nestjs/config';

// Default Soroban RPC endpoints per network, used only when STELLAR_RPC_URL
// is not set explicitly.
const STELLAR_DEFAULT_RPC_URLS: Record<string, string> = {
  mainnet: 'https://soroban-rpc.mainnet.stellar.org',
  testnet: 'https://soroban-testnet.stellar.org',
};

export default registerAs('app', () => {
  const stellarNetwork = process.env.STELLAR_NETWORK || 'testnet';

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    stellarNetwork,
    stellarRpcUrl:
      process.env.STELLAR_RPC_URL ||
      STELLAR_DEFAULT_RPC_URLS[stellarNetwork] ||
      STELLAR_DEFAULT_RPC_URLS.testnet,
    stellarRpcTimeoutMs: process.env.STELLAR_RPC_TIMEOUT_MS
      ? parseInt(process.env.STELLAR_RPC_TIMEOUT_MS, 10)
      : 10000,
    stellarRpcMaxRetries: process.env.STELLAR_RPC_MAX_RETRIES
      ? parseInt(process.env.STELLAR_RPC_MAX_RETRIES, 10)
      : 3,
    stellarRpcRetryBaseDelayMs: process.env.STELLAR_RPC_RETRY_BASE_DELAY_MS
      ? parseInt(process.env.STELLAR_RPC_RETRY_BASE_DELAY_MS, 10)
      : 200,
    workspaceBookingContractId: process.env.WORKSPACE_BOOKING_CONTRACT_ID,
    membershipTokenContractId: process.env.MEMBERSHIP_TOKEN_CONTRACT_ID,
  };
});
