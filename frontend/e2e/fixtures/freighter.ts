import type { Page } from "@playwright/test";

/**
 * Mirrors `FreighterMock` from `src/lib/stellar/walletClient.ts` (not imported
 * directly — `page.addInitScript` payloads must be plain JSON-serializable data,
 * and duplicating the tiny shape here avoids pulling app source into the e2e
 * TS project).
 */
export interface FreighterMockOptions {
  isConnected?: boolean;
  address?: string;
  declineAccess?: boolean;
  declineSigning?: boolean;
}

export const MOCK_WALLET_ADDRESS = "GABCDE2345678FGHJKLMNPQRSTUVWXYZ234567FGHJKLMNPQRSTUV";

/**
 * Installs `window.__E2E_FREIGHTER_MOCK__` before the app's scripts run, so every
 * `@/lib/stellar/walletClient` call resolves against this stub instead of reaching
 * for the real Freighter browser extension (absent in headless CI).
 */
export async function mockFreighter(page: Page, options: FreighterMockOptions = {}): Promise<void> {
  const mock = {
    isConnected: options.isConnected ?? true,
    address: options.address ?? MOCK_WALLET_ADDRESS,
    declineAccess: options.declineAccess ?? false,
    declineSigning: options.declineSigning ?? false,
  };

  await page.addInitScript((m) => {
    (window as unknown as { __E2E_FREIGHTER_MOCK__: unknown }).__E2E_FREIGHTER_MOCK__ = m;
  }, mock);
}
