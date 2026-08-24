import { test, expect } from "@playwright/test";
import { makeUser, seedAuth } from "./fixtures/auth";
import { installApiGuard, mockDashboardWidgets, routeApi, jsonRoute, errorRoute, envelope } from "./fixtures/api";

const USERS = [
  {
    id: "u-1",
    firstname: "Jordan",
    lastname: "Reyes",
    name: "Jordan Reyes",
    email: "jordan.reyes@example.com",
    role: "member" as const,
    verified: true,
    active: true,
    joinedDate: "2026-01-15T00:00:00.000Z",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "u-2",
    firstname: "Sam",
    lastname: "Okafor",
    name: "Sam Okafor",
    email: "sam.okafor@example.com",
    role: "staff" as const,
    verified: true,
    active: true,
    joinedDate: "2026-02-02T00:00:00.000Z",
    createdAt: "2026-02-02T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
];

async function mockUsersList(page: import("@playwright/test").Page) {
  await routeApi(page, /\/users$/, (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get("search")?.toLowerCase();
    const filtered = search
      ? USERS.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      : USERS;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope({ users: filtered, total: filtered.length, page: 1, totalPages: 1 })),
    });
  });
}

test.describe("Admin user management table", () => {
  test.beforeEach(async ({ context, page }) => {
    await installApiGuard(page);
    await mockDashboardWidgets(page);
    await seedAuth(context, page, makeUser({ role: "admin", firstname: "Priya" }));
  });

  test("an admin reaches the user table via the sidebar and can filter it", async ({ page }) => {
    await mockUsersList(page);

    await page.goto("/dashboard");
    // Regression guard: the "Admin" link used to be missing from the sidebar entirely.
    await page.getByRole("link", { name: "Admin" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Jordan Reyes" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Sam Okafor" })).toBeVisible();

    await page.getByPlaceholder("Search by name or email...").fill("Sam");
    await expect(page.getByRole("cell", { name: "Sam Okafor" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Jordan Reyes" })).not.toBeVisible();
  });

  test("updates a user's role", async ({ page }) => {
    await mockUsersList(page);
    await routeApi(page, /\/users\/[^/]+\/role$/, jsonRoute({ message: "Role updated" }));

    await page.goto("/admin");
    const row = page.getByRole("row").filter({ hasText: "Jordan Reyes" });
    await row.getByRole("button").first().click(); // Edit

    await expect(page.getByRole("heading", { name: "Edit User Role" })).toBeVisible();
    await page.getByLabel("Select new role").selectOption("admin");

    await expect(page.getByText("User role updated successfully")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit User Role" })).not.toBeVisible();
  });

  test("shows an error and rolls back the optimistic update when deactivation fails", async ({ page }) => {
    await mockUsersList(page);
    await routeApi(page, /\/users\/[^/]+\/deactivate$/, errorRoute(500, "Could not deactivate user"));

    await page.goto("/admin");
    const row = page.getByRole("row").filter({ hasText: "Jordan Reyes" });
    await expect(row.getByText("Active")).toBeVisible();

    await row.getByRole("button").nth(1).click(); // Deactivate toggle

    await expect(page.getByText("Failed to update user status")).toBeVisible();
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row.getByText("Inactive")).not.toBeVisible();
  });
});
