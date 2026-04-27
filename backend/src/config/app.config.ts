import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  stellarNetwork: process.env.STELLAR_NETWORK || 'testnet',
  workspaceBookingContractId: process.env.WORKSPACE_BOOKING_CONTRACT_ID,
  membershipTokenContractId: process.env.MEMBERSHIP_TOKEN_CONTRACT_ID,
}));
