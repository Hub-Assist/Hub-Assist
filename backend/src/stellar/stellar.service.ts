import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  rpc,
  TransactionBuilder,
  Networks,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
} from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private server: rpc.Server;
  private networkPassphrase: string;
  private workspaceBookingContractId: string;
  private membershipTokenContractId: string;

  constructor(private configService: ConfigService) {
    const network = this.configService.get<string>('app.stellarNetwork', 'testnet');
    this.networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    this.server = new rpc.Server(
      network === 'mainnet'
        ? 'https://soroban-rpc.mainnet.stellar.org'
        : 'https://soroban-testnet.stellar.org'
    );
    this.workspaceBookingContractId = this.configService.get<string>('app.workspaceBookingContractId') || '';
    this.membershipTokenContractId = this.configService.get<string>('app.membershipTokenContractId') || '';
  }

  async verifyTransaction(txHash: string): Promise<any> {
    try {
      const txResponse = await this.server.getTransaction(txHash);
      return txResponse;
    } catch (error) {
      throw new Error(`Failed to verify transaction: ${(error as Error).message}`);
    }
  }

  async getBookingFromContract(bookingId: string): Promise<any> {
    if (!this.workspaceBookingContractId) {
      throw new Error('Workspace booking contract ID not configured');
    }

    const contract = new Contract(this.workspaceBookingContractId);
    const account = await this.server.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'); // Use a dummy account for simulation

    const transaction = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_booking', nativeToScVal(BigInt(bookingId))))
      .setTimeout(30)
      .build();

    try {
      const result = await this.server.simulateTransaction(transaction);
      if ((result as any).result) {
        return (result as any).result.retval;
      } else {
        throw new Error('Simulation failed');
      }
    } catch (error) {
      throw new Error(`Failed to get booking data: ${(error as Error).message}`);
    }
  }

  async getMembershipToken(tokenId: string): Promise<any> {
    if (!this.membershipTokenContractId) {
      throw new Error('Membership token contract ID not configured');
    }

    const contract = new Contract(this.membershipTokenContractId);
    const account = await this.server.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'); // Use a dummy account for simulation

    const transaction = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call('get_token', nativeToScVal(BigInt(tokenId))))
      .setTimeout(30)
      .build();

    try {
      const result = await this.server.simulateTransaction(transaction);
      if ((result as any).result) {
        return (result as any).result.retval;
      } else {
        throw new Error('Simulation failed');
      }
    } catch (error) {
      throw new Error(`Failed to get membership token data: ${(error as Error).message}`);
    }
  }
}