import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';

export async function isFreighterInstalled(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const accessResult = await requestAccess();
  if (accessResult.error) {
    throw new Error(accessResult.error);
  }
  const addressResult = await getAddress();
  if (addressResult.error) {
    throw new Error(addressResult.error);
  }
  return addressResult.address;
}

export async function getPublicKey(): Promise<string | null> {
  const result = await getAddress();
  if (result.error) return null;
  return result.address;
}

export async function signTransactionXdr(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase });
  if (result.error) {
    throw new Error(result.error);
  }
  return result.signedTxXdr;
}
