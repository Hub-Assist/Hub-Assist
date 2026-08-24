import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  rpc,
  TransactionBuilder,
  Networks,
  xdr,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { STELLAR_SIMULATION_ACCOUNT } from './stellar.constants';
import { withStellarRetry, RetryPolicy } from './stellar-rpc.util';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: rpc.Server;
  private readonly networkPassphrase: string;
  private readonly workspaceBookingContractId: string;
  private readonly membershipTokenContractId: string;
  private readonly retryPolicy: RetryPolicy;

  constructor(private configService: ConfigService) {
    const network = this.configService.get<string>('app.stellarNetwork', 'testnet');
    this.networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    const rpcUrl = this.configService.get<string>('app.stellarRpcUrl');
    const timeout = this.configService.get<number>('app.stellarRpcTimeoutMs', 10000);
    this.server = new rpc.Server(rpcUrl!, { timeout });

    this.retryPolicy = {
      maxRetries: this.configService.get<number>('app.stellarRpcMaxRetries', 3),
      baseDelayMs: this.configService.get<number>('app.stellarRpcRetryBaseDelayMs', 200),
    };

    this.workspaceBookingContractId = this.configService.get<string>('app.workspaceBookingContractId') || '';
    this.membershipTokenContractId = this.configService.get<string>('app.membershipTokenContractId') || '';
  }

  private withRetry<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    return withStellarRetry(operationName, operation, this.retryPolicy, this.logger);
  }

  async verifyTransaction(txHash: string): Promise<rpc.Api.GetTransactionResponse> {
    try {
      return await this.withRetry('verifyTransaction', () => this.server.getTransaction(txHash));
    } catch (error) {
      throw new Error(`Failed to verify transaction: ${(error as Error).message}`);
    }
  }

  async publishPaymentEvent(eventType: string, payload: Record<string, any>): Promise<void> {
    if (payload?.stellarTxHash) {
      const txResponse = await this.verifyTransaction(payload.stellarTxHash);
      if (txResponse.status && !['SUCCESS', 'PENDING'].includes(txResponse.status)) {
        throw new Error(`Stellar transaction ${payload.stellarTxHash} status is ${txResponse.status}`);
      }
    }
  }

  async getBookingFromContract(bookingId: string): Promise<xdr.ScVal> {
    if (!this.workspaceBookingContractId) {
      throw new Error('Workspace booking contract ID not configured');
    }

    return this.simulateContractCall(
      this.workspaceBookingContractId,
      'get_booking',
      nativeToScVal(BigInt(bookingId)),
      'getBookingFromContract',
    );
  }

  async getMembershipToken(tokenId: string): Promise<xdr.ScVal> {
    if (!this.membershipTokenContractId) {
      throw new Error('Membership token contract ID not configured');
    }

    return this.simulateContractCall(
      this.membershipTokenContractId,
      'get_token',
      nativeToScVal(BigInt(tokenId)),
      'getMembershipToken',
    );
  }

  private async simulateContractCall(
    contractId: string,
    method: string,
    arg: xdr.ScVal,
    operationName: string,
  ): Promise<xdr.ScVal> {
    const contract = new Contract(contractId);

    try {
      const result = await this.withRetry(operationName, async () => {
        const account = await this.server.getAccount(STELLAR_SIMULATION_ACCOUNT);

        const transaction = new TransactionBuilder(account, {
          fee: '100',
          networkPassphrase: this.networkPassphrase,
        })
          .addOperation(contract.call(method, arg))
          .setTimeout(30)
          .build();

        return this.server.simulateTransaction(transaction);
      });

      if (rpc.Api.isSimulationError(result)) {
        throw new Error(`Simulation failed: ${result.error}`);
      }

      if (!result.result) {
        throw new Error('Simulation returned no result');
      }

      return result.result.retval;
    } catch (error) {
      throw new Error(`Failed to run ${operationName}: ${(error as Error).message}`);
    }
  }
}
