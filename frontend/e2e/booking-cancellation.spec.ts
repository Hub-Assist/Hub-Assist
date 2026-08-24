import { test, expect } from "@playwright/test";
import { makeUser, seedAuth } from "./fixtures/auth";
import { installApiGuard, routeApi, envelope } from "./fixtures/api";

const BOOKING_ID = "bk-1";
// Comfortably inside the 24h refund window relative to `currentDate` (2026-08-21).
const START_TIME = "2026-09-10T09:00:00.000Z";

function bookingPayload(status: "pending" | "confirmed" | "cancelled") {
  return {
    id: BOOKING_ID,
    workspaceName: "Downtown Conference Room",
    date: "2026-09-10",
    startTime: START_TIME,
    endTime: "2026-09-10T11:00:00.000Z",
    amount: 80,
    status,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

test.describe("Booking cancellation / refund flow", () => {
  test.beforeEach(async ({ context, page }) => {
    await installApiGuard(page);
    await seedAuth(context, page, makeUser());
  });

  test("cancels a confirmed booking and reflects the cancellation on the timeline", async ({ page }) => {
    const state: { status: "pending" | "confirmed" | "cancelled" } = { status: "confirmed" };

    await routeApi(page, /\/bookings\/[^/]+$/, (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(bookingPayload(state.status))),
      });
    });
    await routeApi(page, /\/bookings\/[^/]+\/cancel$/, (route) => {
      state.status = "cancelled";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(bookingPayload("cancelled"))),
      });
    });

    await page.goto(`/dashboard/bookings/${BOOKING_ID}`);
    await expect(page.getByRole("heading", { name: "Booking Detail" })).toBeVisible();
    await expect(page.getByTestId("refund-countdown")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Cancel booking?" })).toBeVisible();
    await expect(page.getByText("Estimated refund: $80.00")).toBeVisible();

    await page.getByLabel(/Type "CANCEL" to confirm/).fill("CANCEL");
    await page.getByRole("button", { name: "Confirm cancellation" }).click();

    await expect(page.getByRole("heading", { name: "Cancel booking?" })).not.toBeVisible();
    await expect(page.getByTestId("timeline-step-cancelled")).toHaveAttribute("data-filled", "true");
  });

  test("keeps the confirm button disabled until the exact confirmation phrase is typed", async ({ page }) => {
    await routeApi(page, /\/bookings\/[^/]+$/, (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(bookingPayload("pending"))),
      });
    });

    await page.goto(`/dashboard/bookings/${BOOKING_ID}`);
    await page.getByRole("button", { name: "Cancel" }).click();

    const confirmButton = page.getByRole("button", { name: "Confirm cancellation" });
    await expect(confirmButton).toBeDisabled();

    await page.getByLabel(/Type "CANCEL" to confirm/).fill("cancel");
    await expect(confirmButton).toBeDisabled();

    await page.getByLabel(/Type "CANCEL" to confirm/).fill("CANCEL");
    await expect(confirmButton).toBeEnabled();
  });
});
