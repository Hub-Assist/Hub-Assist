import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Account, StrKey, rpc } from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';
import { STELLAR_SIMULATION_ACCOUNT } from './stellar.constants';

const mockServerInstance = {
  getTransaction: jest.fn(),
  getAccount: jest.fn(),
  simulateTransaction: jest.fn(),
};

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: jest.fn().mockImplementation(() => mockServerInstance),
    },
  };
});

const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32));

describe('StellarService', () => {
  let configValues: Record<string, unknown>;

  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      return key in configValues ? configValues[key] : defaultValue;
    }),
  } as unknown as ConfigService;

  const buildService = async (overrides: Record<string, unknown> = {}) => {
    configValues = {
      'app.stellarNetwork': 'testnet',
      'app.stellarRpcUrl': 'https://soroban-testnet.stellar.org',
      'app.stellarRpcTimeoutMs': 10000,
      'app.stellarRpcMaxRetries': 2,
      'app.stellarRpcRetryBaseDelayMs': 1,
      'app.workspaceBookingContractId': CONTRACT_ID,
      'app.membershipTokenContractId': CONTRACT_ID,
      ...overrides,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StellarService, { provide: ConfigService, useValue: configService }],
    }).compile();

    return module.get(StellarService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configuration', () => {
    it('builds the RPC server from config-driven URL and timeout', async () => {
      await buildService({
        'app.stellarRpcUrl': 'https://custom-rpc.example.com',
        'app.stellarRpcTimeoutMs': 5000,
      });

      expect(rpc.Server).toHaveBeenCalledWith('https://custom-rpc.example.com', { timeout: 5000 });
    });
  });

  describe('verifyTransaction', () => {
    it('returns the typed transaction response on success', async () => {
      const service = await buildService();
      const response = { status: 'SUCCESS', txHash: 'abc' };
      mockServerInstance.getTransaction.mockResolvedValueOnce(response);

      await expect(service.verifyTransaction('abc')).resolves.toBe(response);
      expect(mockServerInstance.getTransaction).toHaveBeenCalledWith('abc');
    });

    it('retries transient failures and succeeds within the retry budget', async () => {
      const service = await buildService();
      mockServerInstance.getTransaction
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ status: 'SUCCESS', txHash: 'abc' });

      await expect(service.verifyTransaction('abc')).resolves.toMatchObject({ status: 'SUCCESS' });
      expect(mockServerInstance.getTransaction).toHaveBeenCalledTimes(2);
    });

    it('fails fast with a typed error once retries are exhausted', async () => {
      const service = await buildService({ 'app.stellarRpcMaxRetries': 1 });
      mockServerInstance.getTransaction.mockRejectedValue(new Error('RPC unreachable'));

      await expect(service.verifyTransaction('abc')).rejects.toThrow(
        /Failed to verify transaction/,
      );
      // 1 initial attempt + 1 retry = 2 calls
      expect(mockServerInstance.getTransaction).toHaveBeenCalledTimes(2);
    });

    it('wraps a StellarRpcError as the cause once retries are exhausted', async () => {
      const service = await buildService({ 'app.stellarRpcMaxRetries': 0 });
      mockServerInstance.getTransaction.mockRejectedValue(new Error('boom'));

      try {
        await service.verifyTransaction('abc');
        fail('expected verifyTransaction to reject');
      } catch (error) {
        expect((error as Error).message).toContain('boom');
      }
    });
  });

  describe('publishPaymentEvent', () => {
    it('does nothing when no stellarTxHash is present', async () => {
      const service = await buildService();
      await expect(service.publishPaymentEvent('booking.confirmed', {})).resolves.toBeUndefined();
      expect(mockServerInstance.getTransaction).not.toHaveBeenCalled();
    });

    it('throws when the transaction status is neither SUCCESS nor PENDING', async () => {
      const service = await buildService();
      mockServerInstance.getTransaction.mockResolvedValue({ status: 'FAILED' });

      await expect(
        service.publishPaymentEvent('booking.confirmed', { stellarTxHash: 'tx-1' }),
      ).rejects.toThrow(/status is FAILED/);
    });
  });

  describe('getBookingFromContract', () => {
    it('throws when the contract ID is not configured', async () => {
      const service = await buildService({ 'app.workspaceBookingContractId': '' });
      await expect(service.getBookingFromContract('1')).rejects.toThrow(
        'Workspace booking contract ID not configured',
      );
      expect(mockServerInstance.getAccount).not.toHaveBeenCalled();
    });

    it('simulates the contract call using the named dummy account and returns the typed retval', async () => {
      const service = await buildService();
      mockServerInstance.getAccount.mockResolvedValue(new Account(STELLAR_SIMULATION_ACCOUNT, '1'));

      const retval = { switch: () => 'scvI32' };
      mockServerInstance.simulateTransaction.mockResolvedValue({
        latestLedger: 1,
        events: [],
        _parsed: true,
        transactionData: {},
        minResourceFee: '100',
        result: { auth: [], retval },
      });

      await expect(service.getBookingFromContract('1')).resolves.toBe(retval);
      expect(mockServerInstance.getAccount).toHaveBeenCalledWith(STELLAR_SIMULATION_ACCOUNT);
    });

    it('throws a descriptive error when simulation reports a failure', async () => {
      const service = await buildService();
      mockServerInstance.getAccount.mockResolvedValue(new Account(STELLAR_SIMULATION_ACCOUNT, '1'));
      mockServerInstance.simulateTransaction.mockResolvedValue({
        latestLedger: 1,
        events: [],
        _parsed: true,
        error: 'contract trapped',
      });

      await expect(service.getBookingFromContract('1')).rejects.toThrow(/contract trapped/);
    });

    it('retries a failed simulation attempt before giving up', async () => {
      const service = await buildService();
      mockServerInstance.getAccount.mockResolvedValue(new Account(STELLAR_SIMULATION_ACCOUNT, '1'));
      const retval = { switch: () => 'scvI32' };
      mockServerInstance.simulateTransaction
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          latestLedger: 1,
          events: [],
          _parsed: true,
          transactionData: {},
          minResourceFee: '100',
          result: { auth: [], retval },
        });

      await expect(service.getBookingFromContract('1')).resolves.toBe(retval);
      expect(mockServerInstance.simulateTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMembershipToken', () => {
    it('throws when the contract ID is not configured', async () => {
      const service = await buildService({ 'app.membershipTokenContractId': '' });
      await expect(service.getMembershipToken('1')).rejects.toThrow(
        'Membership token contract ID not configured',
      );
    });
  });
});
