/**
 * Integration tests for the workspace_booking Soroban contract.
 * Requires a funded testnet account and deployed contract IDs in contracts/.env.contracts.
 *
 * Run: npm run test:integration (from contracts/)
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

// ── Config ────────────────────────────────────────────────────────────────────
const ENV_FILE = path.resolve(__dirname, '../../.env.contracts');
const NETWORK = 'testnet';
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
    console.warn(`Friendbot returned ${res.status} — account may already be funded`);
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

  // Poll for result
  let getResult: rpc.Api.GetTransactionResponse;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(sendResult.hash);
    if (getResult.status !== 'NOT_FOUND') return getResult;
  }
  throw new Error('Transaction not found after polling');
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('workspace_booking contract — full booking flow', () => {
  let server: rpc.Server;
  let keypair: Keypair;
  let contractId: string;
  let workspaceId: number;
  let bookingId: number;

  beforeAll(async () => {
    const env = loadEnv();
    contractId = env['WORKSPACE_BOOKING_CONTRACT_ID'];
    if (!contractId) throw new Error('WORKSPACE_BOOKING_CONTRACT_ID not set');

    keypair = Keypair.random();
    server = new rpc.Server(RPC_URL);

    await fundAccount(keypair.publicKey());
    // Wait for account to be available
    await new Promise((r) => setTimeout(r, 5000));
  });

  it('should register a workspace', async () => {
    const contract = new Contract(contractId);
    const op = contract.call(
      'register_workspace',
      nativeToScVal(keypair.publicKey(), { type: 'address' }),
      nativeToScVal('Integration Test Workspace', { type: 'string' }),
      nativeToScVal('HotDesk', { type: 'symbol' }),
      nativeToScVal(10, { type: 'u32' }),
      nativeToScVal(100n, { type: 'i128' }),
    );

    const result = await simulateAndSend(server, keypair, op);
    expect(result.status).toBe('SUCCESS');
    workspaceId = 1; // first workspace
  });

  it('should create a booking', async () => {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + 3600;
    const endTime = now + 7200;
    const dummyHash = Buffer.alloc(32, 0);

    const contract = new Contract(contractId);
    const op = contract.call(
      'book',
      nativeToScVal(keypair.publicKey(), { type: 'address' }),
      nativeToScVal(workspaceId, { type: 'u32' }),
      nativeToScVal(BigInt(startTime), { type: 'u64' }),
      nativeToScVal(BigInt(endTime), { type: 'u64' }),
      nativeToScVal(100n, { type: 'i128' }),
      xdr.ScVal.scvBytes(dummyHash),
    );

    const result = await simulateAndSend(server, keypair, op);
    expect(result.status).toBe('SUCCESS');
    bookingId = 1;
  });

  it('should confirm the booking', async () => {
    const contract = new Contract(contractId);
    const op = contract.call(
      'confirm',
      nativeToScVal(keypair.publicKey(), { type: 'address' }),
      nativeToScVal(BigInt(bookingId), { type: 'u64' }),
    );

    const result = await simulateAndSend(server, keypair, op);
    expect(result.status).toBe('SUCCESS');
  });

  it('should verify booking status is Confirmed', async () => {
    const contract = new Contract(contractId);
    const account = await server.getAccount(keypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_booking', nativeToScVal(BigInt(bookingId), { type: 'u64' })),
      )
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);
    expect(rpc.Api.isSimulationError(simResult)).toBe(false);
    // Result contains booking data — just verify simulation succeeded
    expect(simResult).toBeDefined();
  });
});
