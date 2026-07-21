/**
 * Integration tests for the membership_token Soroban contract.
 * Requires a funded testnet account and deployed contract IDs in contracts/.env.contracts.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Keypair,
  Networks,
  rpc,
  TransactionBuilder,
  Contract,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';

const ENV_FILE = path.resolve(__dirname, '../../.env.contracts');
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(`${ENV_FILE} not found. Run deploy.sh first.`);
  }
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function fundAccount(address: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${address}`);
  if (!res.ok && res.status !== 400) {
    console.warn(`Friendbot returned ${res.status}`);
  }
}

async function simulateAndSend(
  server: rpc.Server,
  keypair: Keypair,
  operation: xdr.Operation,
): Promise<rpc.Api.GetTransactionResponse> {
  const account = await server.getAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Send failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  let getResult: rpc.Api.GetTransactionResponse;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(sendResult.hash);
    if (getResult.status !== 'NOT_FOUND') return getResult;
  }
  throw new Error('Transaction not found after polling');
}

describe('membership_token contract — full token flow', () => {
  let server: rpc.Server;
  let adminKeypair: Keypair;
  let memberKeypair: Keypair;
  let contractId: string;
  let tokenId: bigint;

  beforeAll(async () => {
    const env = loadEnv();
    contractId = env['MEMBERSHIP_TOKEN_CONTRACT_ID'];
    if (!contractId) throw new Error('MEMBERSHIP_TOKEN_CONTRACT_ID not set');

    adminKeypair = Keypair.random();
    memberKeypair = Keypair.random();
    server = new rpc.Server(RPC_URL);

    await fundAccount(adminKeypair.publicKey());
    await fundAccount(memberKeypair.publicKey());
    await new Promise((r) => setTimeout(r, 5000));
  });

  it('should issue a membership token', async () => {
    const expiryDate = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365);
    const contract = new Contract(contractId);
    const op = contract.call(
      'issue_token',
      nativeToScVal(adminKeypair.publicKey(), { type: 'address' }),
      nativeToScVal(memberKeypair.publicKey(), { type: 'address' }),
      nativeToScVal(1, { type: 'u32' }),
      nativeToScVal(expiryDate, { type: 'u64' }),
    );

    const result = await simulateAndSend(server, adminKeypair, op);
    expect(result.status).toBe('SUCCESS');
    tokenId = 1n;
  });

  it('should get the issued token', async () => {
    const contract = new Contract(contractId);
    const account = await server.getAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_token', nativeToScVal(tokenId, { type: 'u64' })))
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    expect(rpc.Api.isSimulationError(simResult)).toBe(false);
    expect(simResult).toBeDefined();
  });

  it('should transfer the token to another address', async () => {
    const newOwner = Keypair.random();
    await fundAccount(newOwner.publicKey());
    await new Promise((r) => setTimeout(r, 3000));

    const contract = new Contract(contractId);
    const op = contract.call(
      'transfer_token',
      nativeToScVal(tokenId, { type: 'u64' }),
      nativeToScVal(newOwner.publicKey(), { type: 'address' }),
    );

    const result = await simulateAndSend(server, memberKeypair, op);
    expect(result.status).toBe('SUCCESS');
  });

  it('should get token status', async () => {
    const contract = new Contract(contractId);
    const account = await server.getAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_token_status', nativeToScVal(tokenId, { type: 'u64' })),
      )
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    expect(rpc.Api.isSimulationError(simResult)).toBe(false);
  });
});
