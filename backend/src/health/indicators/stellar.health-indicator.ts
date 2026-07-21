import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

const STELLAR_RPC_URLS: Record<string, string> = {
  mainnet: 'https://soroban-rpc.mainnet.stellar.org',
  testnet: 'https://soroban-testnet.stellar.org',
};

@Injectable()
export class StellarHealthIndicator extends HealthIndicator {
  private readonly rpcUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.rpcUrl = STELLAR_RPC_URLS[network] ?? STELLAR_RPC_URLS['testnet'];
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new HealthCheckError(
          `Stellar RPC returned HTTP ${response.status}`,
          this.getStatus(key, false, {
            status: 'down',
            httpStatus: response.status,
            url: this.rpcUrl,
          }),
        );
      }

      const body = (await response.json()) as { result?: { status?: string } };
      const rpcStatus = body?.result?.status;

      return this.getStatus(key, true, {
        status: 'up',
        rpcStatus: rpcStatus ?? 'unknown',
        url: this.rpcUrl,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof HealthCheckError) throw err;

      throw new HealthCheckError(
        `Stellar RPC health check failed: ${(err as Error).message}`,
        this.getStatus(key, false, {
          status: 'down',
          error: (err as Error).message,
          url: this.rpcUrl,
        }),
      );
    }
  }
}
