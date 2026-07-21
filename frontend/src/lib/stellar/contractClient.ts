import { rpc, TransactionBuilder, Networks, BASE_FEE, Contract, xdr } from '@stellar/stellar-sdk';
import { signTransactionXdr } from './walletClient';

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

const RPC_URLS: Record<string, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban-mainnet.stellar.org',
};

const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

export function getRpcServer() {
  return new rpc.Server(RPC_URLS[NETWORK]);
}

export async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourcePublicKey: string,
): Promise<rpc.Api.GetTransactionResponse> {
  const server = getRpcServer();
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASES[NETWORK],
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  const signedXdr = await signTransactionXdr(
    preparedTx.toXDR(),
    NETWORK_PASSPHRASES[NETWORK],
  );

  const { hash } = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASES[NETWORK]),
  );

  // Poll for result
  let response: rpc.Api.GetTransactionResponse;
  do {
    await new Promise((r) => setTimeout(r, 1000));
    response = await server.getTransaction(hash);
  } while (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND);

  return response;
}
