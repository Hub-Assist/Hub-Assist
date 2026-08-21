import { test, expect } from "@playwright/test";
import { buildFakeJwt, makeUser } from "./fixtures/auth";
import { installApiGuard, mockDashboardWidgets, routeApi, jsonRoute, errorRoute } from "./fixtures/api";

test.describe("Auth journey", () => {
  test("register redirects to email verification, and a correct code lands on the dashboard", async ({ page }) => {
    await installApiGuard(page);
    await mockDashboardWidgets(page);

    const email = "new.member@example.com";
    const user = makeUser({ email });
    const token = buildFakeJwt({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 });

    await routeApi(page, /\/auth\/register$/, jsonRoute({ message: "Check your email for a verification code." }));
    await routeApi(page, /\/auth\/verify-otp$/, jsonRoute({ access_token: token }));

    await page.goto("/register");
    await page.getByPlaceholder("Jane").fill("Jordan");
    await page.getByPlaceholder("Doe").fill("Reyes");
    await page.getByPlaceholder("you@workspace.com").fill(email);
    await page.getByPlaceholder("••••••••").first().fill("Sup3rSecret!");
    await page.getByPlaceholder("••••••••").nth(1).fill("Sup3rSecret!");
    await page.getByRole("button", { name: "Create account" }).click();

    // Regression guard: RegisterForm used to push to the nonexistent `/auth/verify-otp`.
    await expect(page).toHaveURL(new RegExp(`/verify-otp\\?email=${encodeURIComponent(email)}`));
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

    for (let i = 0; i < 6; i++) {
      await page.getByLabel(`Digit ${i + 1}`).pressSequentially(String((i + 1) % 10));
    }
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  });

  test("an invalid verification code shows an error and keeps the user on the page", async ({ page }) => {
    await installApiGuard(page);

    const email = "new.member@example.com";
    await routeApi(page, /\/auth\/verify-otp$/, errorRoute(400, "Invalid or expired OTP."));

    await page.goto(`/verify-otp?email=${encodeURIComponent(email)}`);
    for (let i = 0; i < 6; i++) {
      await page.getByLabel(`Digit ${i + 1}`).pressSequentially("9");
    }
    await page.getByRole("button", { name: "Verify" }).click();

    // Next.js's own hidden route announcer also carries role="alert", so match on text instead.
    await expect(page.getByText(/invalid or expired otp/i)).toBeVisible();
    await expect(page).toHaveURL(/\/verify-otp/);
  });

  test("logs in and lands on the dashboard", async ({ page }) => {
    await installApiGuard(page);
    await mockDashboardWidgets(page);

    const user = makeUser({ firstname: "Amina" });
    const token = buildFakeJwt({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 });
    await routeApi(page, /\/auth\/login$/, jsonRoute({ access_token: token, user }));

    await page.goto("/login");
    await page.getByPlaceholder("you@workspace.com").fill(user.email);
    await page.getByPlaceholder("••••••••").fill("Sup3rSecret!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: `Welcome back, ${user.firstname}` })).toBeVisible();
  });

  test("invalid credentials show an error and keep the user on the login page", async ({ page }) => {
    await installApiGuard(page);
    await routeApi(page, /\/auth\/login$/, errorRoute(401, "Invalid email or password."));

    await page.goto("/login");
    await page.getByPlaceholder("you@workspace.com").fill("nobody@example.com");
    await page.getByPlaceholder("••••••••").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("visiting a protected route while signed out redirects to login with a return path", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });
});
