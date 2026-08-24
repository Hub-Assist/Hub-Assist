import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';

/**
 * e2e/CI test seam.
 *
 * `@stellar/freighter-api` talks to the real Freighter browser extension via
 * `window.postMessage`, which has no counterpart in a headless CI browser.
 * Playwright specs stub this exact shape via `page.addInitScript` (see
 * `frontend/e2e/fixtures/freighter.ts`) *before* the app loads — real users
 * never set this global, so production behavior is unaffected.
 */
export interface FreighterMock {
  isConnected: boolean;
  address: string;
  /** Simulate the user declining the Freighter access prompt. */
  declineAccess?: boolean;
  /** Simulate the user declining/cancelling a transaction signature. */
  declineSigning?: boolean;
}

declare global {
  interface Window {
    __E2E_FREIGHTER_MOCK__?: FreighterMock;
  }
}

function getMock(): FreighterMock | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__E2E_FREIGHTER_MOCK__;
}

export async function isFreighterInstalled(): Promise<boolean> {
  const mock = getMock();
  if (mock) return mock.isConnected;

  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const mock = getMock();
  if (mock) {
    if (mock.declineAccess) {
      throw new Error('User declined access');
    }
    return mock.address;
  }

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
  const mock = getMock();
  if (mock) return mock.address;

  const result = await getAddress();
  if (result.error) return null;
  return result.address;
}

export async function signTransactionXdr(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const mock = getMock();
  if (mock) {
    if (mock.declineSigning) {
      throw new Error('User declined signing');
    }
    return xdr;
  }

  const result = await signTransaction(xdr, { networkPassphrase });
  if (result.error) {
    throw new Error(result.error);
  }
  return result.signedTxXdr;
}
