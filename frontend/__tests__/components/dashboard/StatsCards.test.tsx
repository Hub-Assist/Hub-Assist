import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatsCards } from "@/components/dashboard/StatsCards";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createClient()}>
      {children}
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We mock useQuery at the module level so each test can control the state.
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return { ...actual, useQuery: jest.fn() };
});

const { useQuery } = jest.requireMock("@tanstack/react-query") as {
  useQuery: jest.Mock;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatsCards", () => {
  afterEach(() => jest.resetAllMocks());

  it("renders the skeleton while loading", () => {
    useQuery.mockReturnValue({ isPending: true, isError: false, data: undefined });

    render(<StatsCards />, { wrapper: Wrapper });

    // Skeleton container is present
    expect(screen.getByTestId("stats-cards-skeleton")).toBeInTheDocument();
    // No stat card labels rendered yet
    expect(screen.queryByText("TOTAL MEMBERS")).not.toBeInTheDocument();
  });

  it("skeleton root carries aria-hidden='true'", () => {
    useQuery.mockReturnValue({ isPending: true, isError: false, data: undefined });

    render(<StatsCards />, { wrapper: Wrapper });

    const skeleton = screen.getByTestId("stats-cards-skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
  });

  it("renders stat cards when data is available", () => {
    useQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        totalMembers: 42,
        verifiedMembers: 38,
        activeWorkspaces: 7,
        deskOccupancy: 85,
      },
    });

    render(<StatsCards />, { wrapper: Wrapper });

    // Skeleton should be gone
    expect(screen.queryByTestId("stats-cards-skeleton")).not.toBeInTheDocument();

    // Real content is present
    expect(screen.getByText("TOTAL MEMBERS")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("VERIFIED MEMBERS")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE WORKSPACES")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("DESK OCCUPANCY")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders null when data is undefined after loading", () => {
    useQuery.mockReturnValue({ isPending: false, isError: false, data: undefined });

    const { container } = render(<StatsCards />, { wrapper: Wrapper });
    // Component returns null — nothing rendered
    expect(container.firstChild).toBeNull();
  });

  it("throws an error boundary-compatible error when isError is true", () => {
    useQuery.mockReturnValue({ isPending: false, isError: true, data: undefined });

    // Suppress console.error for this test (ErrorBoundary will catch it)
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(<StatsCards />, { wrapper: Wrapper })
    ).toThrow("Failed to load dashboard statistics.");

    consoleSpy.mockRestore();
  });
});
