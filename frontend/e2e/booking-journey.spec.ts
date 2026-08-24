import { test, expect } from "@playwright/test";
import { makeUser, seedAuth } from "./fixtures/auth";
import { installApiGuard, routeApi, jsonRoute, errorRoute, envelope } from "./fixtures/api";

const WORKSPACE = {
  id: "ws-1",
  name: "Downtown Conference Room",
  type: "conference-room",
  capacity: 8,
  pricePerHour: 40,
  availability: true,
  description: "A bright conference room in the heart of downtown.",
  amenities: ["Projector", "Whiteboard"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test.describe("Workspace search → booking creation (money-moving path)", () => {
  test.beforeEach(async ({ context, page }) => {
    await installApiGuard(page);
    await seedAuth(context, page, makeUser());
  });

  test("finds a workspace by name, opens its detail page, and books it", async ({ page }) => {
    await routeApi(page, /\/workspaces$/, (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get("search");
      const matches = !search || WORKSPACE.name.toLowerCase().includes(search.toLowerCase());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope({ workspaces: matches ? [WORKSPACE] : [] })),
      });
    });
    await routeApi(page, /\/workspaces\/[^/]+$/, jsonRoute({ workspace: WORKSPACE }));
    await routeApi(
      page,
      /\/bookings$/,
      jsonRoute({
        booking: {
          id: "bk-1",
          workspaceName: WORKSPACE.name,
          date: "2026-09-01",
          startTime: "2026-09-01T09:00:00.000Z",
          endTime: "2026-09-01T11:00:00.000Z",
          amount: 80,
          status: "pending",
        },
        message: "Booking created successfully",
      }, 201),
    );

    await page.goto("/workspaces");
    await page.getByLabel(/search workspaces/i).fill("Conference");
    await expect(page.getByText(/1 workspace found for/)).toBeVisible();

    // Regression guard: the list used to render cards with no link to the detail page.
    await page.getByRole("heading", { name: WORKSPACE.name }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${WORKSPACE.id}$`));
    await expect(page.getByRole("heading", { name: WORKSPACE.name })).toBeVisible();
    await expect(page.getByText(`$${WORKSPACE.pricePerHour}/hour`)).toBeVisible();

    await page.locator("#startTime").fill("2026-09-01T09:00");
    await page.locator("#endTime").fill("2026-09-01T11:00");
    await expect(page.getByText("$80.00")).toBeVisible();

    await page.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(page.getByText("Booking created successfully")).toBeVisible();
  });

  test("shows an error when the slot becomes unavailable before booking confirms", async ({ page }) => {
    await routeApi(page, /\/workspaces\/[^/]+$/, jsonRoute({ workspace: WORKSPACE }));
    await routeApi(page, /\/bookings$/, errorRoute(409, "This slot was just booked by someone else."));

    await page.goto(`/workspaces/${WORKSPACE.id}`);
    await page.locator("#startTime").fill("2026-09-01T09:00");
    await page.locator("#endTime").fill("2026-09-01T11:00");
    await page.getByRole("button", { name: "Confirm Booking" }).click();

    await expect(page.getByText("Failed to create booking")).toBeVisible();
    // The form must not be cleared on failure so the user can retry without re-entering times.
    await expect(page.locator("#startTime")).toHaveValue("2026-09-01T09:00");
  });
});
