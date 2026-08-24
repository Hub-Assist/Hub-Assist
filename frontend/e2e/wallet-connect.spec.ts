import { test, expect } from "@playwright/test";
import { makeUser, seedAuth } from "./fixtures/auth";
import { installApiGuard, routeApi, jsonRoute } from "./fixtures/api";
import { mockFreighter, MOCK_WALLET_ADDRESS } from "./fixtures/freighter";

test.describe("Freighter wallet connect (Settings)", () => {
  test.beforeEach(async ({ context, page }) => {
    await installApiGuard(page);
    await seedAuth(context, page, makeUser());
  });

  test("connects a Freighter wallet and shows the truncated address", async ({ page }) => {
    await mockFreighter(page, { isConnected: true, address: MOCK_WALLET_ADDRESS });
    await routeApi(page, /\/users\/[^/]+$/, jsonRoute({ message: "User updated" }));

    await page.goto("/settings");
    await page.getByRole("button", { name: "Connect Freighter Wallet" }).click();

    await expect(page.getByText("Wallet connected successfully")).toBeVisible();
    await expect(page.getByTitle(MOCK_WALLET_ADDRESS)).toBeVisible();
    await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  });

  test("shows an install prompt when Freighter is not installed", async ({ page }) => {
    await mockFreighter(page, { isConnected: false });

    await page.goto("/settings");
    await page.getByRole("button", { name: "Connect Freighter Wallet" }).click();

    await expect(page.getByText(/Freighter wallet is not installed/i)).toBeVisible();
  });

  test("shows an error when the user declines the connection request", async ({ page }) => {
    await mockFreighter(page, { isConnected: true, declineAccess: true });

    await page.goto("/settings");
    await page.getByRole("button", { name: "Connect Freighter Wallet" }).click();

    await expect(page.getByText("User declined access")).toBeVisible();
  });
});
