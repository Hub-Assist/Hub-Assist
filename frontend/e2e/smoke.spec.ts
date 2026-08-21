import { test, expect } from "@playwright/test";

test.describe("Landing page smoke", () => {
  test("landing page loads with brand, hero, and primary nav", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/HubAssist/);
    await expect(page.getByText("Hubassist", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Powering joyful workspaces with trusted automation/i }),
    ).toBeVisible();

    // Primary nav links render and point at their landing sections.
    const navLinks = [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Trusted by", href: "#trusted-by" },
      { label: "Newsletter", href: "#newsletter" },
    ];
    for (const { label, href } of navLinks) {
      const link = page.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }

    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Book a demo" })).toBeVisible();
  });

  test("primary nav: Sign in navigates to the login page with the password form", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByPlaceholder("you@workspace.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("primary nav: landing section anchors scroll to their sections", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Features", exact: true }).click();
    await expect(page).toHaveURL(/#features$/);

    await page.getByRole("link", { name: "How it works", exact: true }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
  });
});
