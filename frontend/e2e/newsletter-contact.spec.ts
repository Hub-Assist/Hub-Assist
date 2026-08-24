import { test, expect } from "@playwright/test";
import { installApiGuard, routeApi, jsonRoute, errorRoute, envelope } from "./fixtures/api";

test.describe("Newsletter subscribe/unsubscribe and contact form", () => {
  test("subscribes to the newsletter from the landing page", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/newsletter\/subscribe$/, jsonRoute({ message: "Subscribed" }, 201));

    await page.goto("/");
    await page.getByPlaceholder("Enter your work email").fill("reader@example.com");
    await page.getByRole("button", { name: "Subscribe" }).click();

    await expect(page.getByText("Successfully subscribed to the newsletter!")).toBeVisible();
  });

  test("shows an already-subscribed message on a duplicate email", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/newsletter\/subscribe$/, errorRoute(409, "Email already subscribed"));

    await page.goto("/");
    await page.getByPlaceholder("Enter your work email").fill("reader@example.com");
    await page.getByRole("button", { name: "Subscribe" }).click();

    await expect(page.getByText("This email is already subscribed.")).toBeVisible();
  });

  test("unsubscribes from the newsletter preferences page", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/newsletter\/preferences\/[^/]+$/, (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            email: "reader@example.com",
            preferences: { workspaceUpdates: true, community: true, promotions: true, productUpdates: true },
          }),
        ),
      });
    });
    await routeApi(page, /\/newsletter\/unsubscribe\/[^/]+$/, jsonRoute({ message: "Unsubscribed" }));

    await page.goto("/newsletter/preferences?token=valid-token");
    await expect(page.getByRole("heading", { name: "Newsletter Preferences" })).toBeVisible();

    await page.getByRole("button", { name: "Unsubscribe from all emails" }).click();

    await expect(page.getByText("You have been unsubscribed")).toBeVisible();
  });

  test("shows an invalid-link state when the preferences token doesn't resolve", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/newsletter\/preferences\/[^/]+$/, errorRoute(404, "Not found"));

    await page.goto("/newsletter/preferences?token=expired-token");

    await expect(page.getByText("Link expired")).toBeVisible();
  });

  test("submits the contact form successfully", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/contact$/, jsonRoute({ message: "Message received" }, 201));

    await page.goto("/contact");
    await page.getByLabel("Full Name").fill("Taylor Morgan");
    await page.getByLabel("Email Address").fill("taylor.morgan@example.com");
    await page.getByLabel("Subject").fill("Question about bookings");
    await page.getByLabel("Message").fill("Can I book a meeting room for a full week?");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByRole("heading", { name: "Message Sent!" })).toBeVisible();
  });

  test("shows an error when the contact form submission fails", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/contact$/, errorRoute(500, "Failed to send message. Please try again."));

    await page.goto("/contact");
    await page.getByLabel("Full Name").fill("Taylor Morgan");
    await page.getByLabel("Email Address").fill("taylor.morgan@example.com");
    await page.getByLabel("Subject").fill("Question about bookings");
    await page.getByLabel("Message").fill("Can I book a meeting room for a full week?");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByText("Failed to send message. Please try again.")).toBeVisible();
  });
});
