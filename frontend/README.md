# HubAssist Frontend

Next.js 15 (App Router) + React 19 + Tailwind CSS frontend for HubAssist. See the
[root README](../README.md) for the full monorepo overview.

## Getting started

```bash
cd frontend
npm install

# Environment (only NEXT_PUBLIC_* vars are exposed to the browser)
cp .env.example .env.local

npm run dev          # http://localhost:3000
npm run build        # production build (next build)
npm run start        # serve the production build
```

Key env vars:

| Variable                  | Default                    | Description                          |
|---------------------------|----------------------------|--------------------------------------|
| `NEXT_PUBLIC_API_URL`     | `http://localhost:3001/api/v1` | Backend API base URL.           |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet`              | Stellar network the UI references.   |

## Testing

### Unit / component tests (Jest)

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

### End-to-end tests (Playwright)

The e2e suite lives in [`e2e/`](./e2e) and drives a real Chromium browser
against the running Next.js app. It is the only test layer that exercises
routing, multi-step forms, and browser-integration code end to end.

**One-time browser install:**

```bash
npx playwright install chromium
# On Linux CI/headless machines, also install OS dependencies:
npx playwright install --with-deps chromium
```

**Run the suite:**

```bash
npm run test:e2e
```

Playwright starts the app itself via the `webServer` block in
[`playwright.config.ts`](./playwright.config.ts):

- **Locally** — `npm run dev` (and reuses an already-running dev server on port 3000).
- **In CI** — `npm run build && npm run start`, so tests run against a real production build.

Useful flags:

```bash
npm run test:e2e -- --headed       # watch tests in a visible browser
npm run test:e2e -- --ui           # interactive Playwright UI
npm run test:e2e -- --grep smoke   # run only smoke tests
npm run test:e2e -- --project chromium
```

The current smoke suite verifies the landing page boots (brand, hero, primary
nav), that primary navigation works (`Sign in` → `/login` with the password
form), and that landing section anchors scroll correctly. It intentionally does
**not** require the backend — the pages it visits make no API calls on load.

From the repo root you can also run the whole suite with:

```bash
npm run test:frontend:e2e
```

### CI

The `E2E / Frontend` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs on every PR and push to `main`: it installs dependencies, installs the
Chromium browser (`npx playwright install --with-deps chromium`), runs
`npm run test:e2e`, and uploads `frontend/playwright-report` as an artifact if
anything fails.

## Stellar wallet (Freighter) in e2e tests

Wallet flows (see [`src/lib/stellar/walletClient.ts`](./src/lib/stellar/walletClient.ts))
use `@stellar/freighter-api`, which talks to the Freighter extension through a
`window.freighter` object and `window.postMessage` messages. In headless CI
there is no extension, so any test that exercises wallet interaction must stub
it.

The planned approach for Issue #9 is to inject a mock `window.freighter` before
the app loads using Playwright's `page.addInitScript` — e.g.:

```ts
import { test } from "@playwright/test";

test("wallet connect flow with stubbed Freighter", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).freighter = {
      isConnected: async () => ({ isConnected: true }),
      requestAccess: async () => ({ publicKey: "G...MOCK...", error: undefined }),
      getAddress: async () => ({ address: "G...MOCK...", error: undefined }),
      signTransaction: async (xdr: string, opts: unknown) => ({
        signedTxXdr: xdr,
        error: undefined,
      }),
    };
  });

  await page.goto("/some-wallet-page");
  // ...assert the UI shows the mocked connected wallet...
});
```

Shared mocks like this should live in a `frontend/e2e/fixtures/` or
`frontend/e2e/mocks/` helper module so multiple specs can reuse them. Real
extension-driven flows (with the actual Freighter extension installed) remain a
manual/`--headed`-only exercise.
