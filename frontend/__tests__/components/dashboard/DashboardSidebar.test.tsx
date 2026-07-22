/**
 * @jest-environment jsdom
 *
 * Tests for DashboardSidebar keyboard navigation and WCAG 2.1 AA compliance:
 *   - aria-current="page" applied to the active route link only
 *   - Tab order covers every nav link and the logout button
 *   - Alt+N shortcuts navigate to the correct route
 *   - Shortcuts are ignored while focus is inside an <input>
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

// ─── Mock next/navigation ────────────────────────────────────────────────────
const mockPush = jest.fn();
let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock next/link ──────────────────────────────────────────────────────────
// next/link renders an <a> in test; keep it simple to avoid RSC issues.
jest.mock("next/link", () => {
  const Link = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = "Link";
  return Link;
});

// ─── Mock authStore ───────────────────────────────────────────────────────────
jest.mock("@/lib/store/authStore", () => ({
  useAuthStore: (selector: (s: { user: { firstname: string; role: string } | null; clear: () => void }) => unknown) =>
    selector({
      user: { firstname: "Alice", role: "admin" },
      clear: jest.fn(),
    }),
}));

// ─── Mock ThemeToggle ─────────────────────────────────────────────────────────
jest.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle theme" />,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSidebar(pathname = "/dashboard") {
  mockPathname = pathname;
  mockPush.mockClear();
  return render(<DashboardSidebar />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DashboardSidebar – aria-current", () => {
  it('sets aria-current="page" on the active Dashboard link', () => {
    renderSidebar("/dashboard");
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("does NOT set aria-current on inactive links", () => {
    renderSidebar("/dashboard");
    const inactiveLinks = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href") !== "/dashboard");

    for (const link of inactiveLinks) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it('sets aria-current="page" on /dashboard/bookings when that route is active', () => {
    renderSidebar("/dashboard/bookings");
    const bookingsLink = screen.getByRole("link", { name: /bookings/i });
    expect(bookingsLink).toHaveAttribute("aria-current", "page");
  });

  it("moves aria-current when the pathname changes", () => {
    const { rerender } = render(<DashboardSidebar />);

    mockPathname = "/dashboard/workspaces";
    rerender(<DashboardSidebar />);

    const workspacesLink = screen.getByRole("link", { name: /workspaces/i });
    expect(workspacesLink).toHaveAttribute("aria-current", "page");

    const dashboardLink = screen.getByRole("link", { name: /^dashboard/i });
    expect(dashboardLink).not.toHaveAttribute("aria-current");
  });
});

describe("DashboardSidebar – Tab order (keyboard navigation)", () => {
  it("all nav links are reachable via Tab (tabIndex=0)", async () => {
    renderSidebar("/dashboard");
    const user = userEvent.setup();

    const navElement = screen.getByRole("navigation", { name: /sidebar navigation/i });
    const links = within(navElement).getAllByRole("link");

    // Every link must be focusable (tabIndex 0 or not set, both mean 0)
    for (const link of links) {
      const tabIndex = link.getAttribute("tabindex");
      // tabIndex null (default) or "0" are both reachable
      expect(tabIndex === null || tabIndex === "0").toBe(true);
    }

    // Navigate through all links via Tab from the first one
    links[0].focus();
    expect(links[0]).toHaveFocus();

    for (let i = 1; i < links.length; i++) {
      await user.tab();
      expect(links[i]).toHaveFocus();
    }
  });

  it("logout button is reachable via Tab after nav links", async () => {
    renderSidebar("/dashboard");
    const user = userEvent.setup();

    const navElement = screen.getByRole("navigation", { name: /sidebar navigation/i });
    const links = within(navElement).getAllByRole("link");

    // Focus last nav link then tab to logout
    links[links.length - 1].focus();
    await user.tab();

    const logoutBtn = screen.getByRole("button", { name: /log out/i });
    expect(logoutBtn).toHaveFocus();
  });
});

describe("DashboardSidebar – keyboard shortcuts (Alt+N)", () => {
  it("Alt+3 navigates to /dashboard/bookings", async () => {
    renderSidebar("/dashboard");
    const user = userEvent.setup();

    await user.keyboard("{Alt>}3{/Alt}");

    expect(mockPush).toHaveBeenCalledWith("/dashboard/bookings");
  });

  it("Alt+1 navigates to /dashboard", async () => {
    renderSidebar("/dashboard/bookings");
    const user = userEvent.setup();

    await user.keyboard("{Alt>}1{/Alt}");

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("Alt+2 navigates to /dashboard/workspaces", async () => {
    renderSidebar("/dashboard");
    const user = userEvent.setup();

    await user.keyboard("{Alt>}2{/Alt}");

    expect(mockPush).toHaveBeenCalledWith("/dashboard/workspaces");
  });

  it("shortcut is ignored while an input element has focus", async () => {
    renderSidebar("/dashboard");
    const user = userEvent.setup();

    // Render an input and focus it
    const { baseElement } = render(
      <input data-testid="text-input" defaultValue="" />
    );
    const input = baseElement.querySelector("[data-testid='text-input']") as HTMLInputElement;
    input.focus();

    await user.keyboard("{Alt>}3{/Alt}");

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("DashboardSidebar – ARIA landmarks", () => {
  it("has an aside landmark with label 'Main navigation'", () => {
    renderSidebar("/dashboard");
    expect(
      screen.getByRole("complementary", { name: /main navigation/i })
    ).toBeInTheDocument();
  });

  it("nav inside aside is labelled 'Sidebar navigation'", () => {
    renderSidebar("/dashboard");
    expect(
      screen.getByRole("navigation", { name: /sidebar navigation/i })
    ).toBeInTheDocument();
  });
});
