/**
 * Snapshot tests for dashboard skeleton components.
 *
 * Goals:
 *  1. Guard against unintended visual/structural regressions.
 *  2. Verify aria-hidden="true" on every skeleton root.
 *  3. Verify the correct number of placeholder elements per skeleton.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { StatsCardsSkeleton } from "@/components/dashboard/skeletons/StatsCardsSkeleton";
import { AnalyticsChartSkeleton } from "@/components/dashboard/skeletons/AnalyticsChartSkeleton";
import { ActivityFeedSkeleton } from "@/components/dashboard/skeletons/ActivityFeedSkeleton";
import { BookingListSkeleton } from "@/components/dashboard/skeletons/BookingListSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

// ---------------------------------------------------------------------------
// Skeleton primitive
// ---------------------------------------------------------------------------

describe("Skeleton primitive", () => {
  it("renders with aria-hidden='true'", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("merges additional className props", () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    expect(container.firstChild).toHaveClass("h-4", "w-full");
  });

  it("matches snapshot", () => {
    const { container } = render(<Skeleton className="h-8 w-32 rounded-md" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// StatsCardsSkeleton
// ---------------------------------------------------------------------------

describe("StatsCardsSkeleton", () => {
  it("renders with aria-hidden='true' on the root", () => {
    render(<StatsCardsSkeleton />);
    expect(screen.getByTestId("stats-cards-skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders exactly 4 skeleton cards", () => {
    const { container } = render(<StatsCardsSkeleton />);
    // Each inner Skeleton is a div with animate-pulse
    const cards = container.querySelectorAll('[aria-hidden="true"] [aria-hidden="true"]');
    expect(cards).toHaveLength(4);
  });

  it("matches snapshot", () => {
    const { container } = render(<StatsCardsSkeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// AnalyticsChartSkeleton
// ---------------------------------------------------------------------------

describe("AnalyticsChartSkeleton", () => {
  it("renders with aria-hidden='true' on the root", () => {
    render(<AnalyticsChartSkeleton />);
    expect(screen.getByTestId("analytics-chart-skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("contains a header row and a chart area skeleton", () => {
    const { container } = render(<AnalyticsChartSkeleton />);
    // Header row has 2 skeletons (label + toggle), chart area has 1 → 3 total
    const skeletons = container.querySelectorAll('[aria-hidden="true"] [aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("matches snapshot", () => {
    const { container } = render(<AnalyticsChartSkeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// ActivityFeedSkeleton
// ---------------------------------------------------------------------------

describe("ActivityFeedSkeleton", () => {
  it("renders with aria-hidden='true' on the root", () => {
    render(<ActivityFeedSkeleton />);
    expect(screen.getByTestId("activity-feed-skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders exactly 4 activity row placeholders", () => {
    render(<ActivityFeedSkeleton />);
    // Each row is a direct child div of the root
    const root = screen.getByTestId("activity-feed-skeleton");
    expect(root.children).toHaveLength(4);
  });

  it("each row contains icon, description, and timestamp skeletons", () => {
    render(<ActivityFeedSkeleton />);
    const root = screen.getByTestId("activity-feed-skeleton");
    const firstRow = root.children[0];
    // 3 Skeleton elements inside each row
    const skeletons = firstRow.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(3);
  });

  it("matches snapshot", () => {
    const { container } = render(<ActivityFeedSkeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// BookingListSkeleton
// ---------------------------------------------------------------------------

describe("BookingListSkeleton", () => {
  it("renders with aria-hidden='true' on the root", () => {
    render(<BookingListSkeleton />);
    expect(screen.getByTestId("booking-list-skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders exactly 3 booking card placeholders", () => {
    render(<BookingListSkeleton />);
    const root = screen.getByTestId("booking-list-skeleton");
    expect(root.children).toHaveLength(3);
  });

  it("each card contains two rows of skeleton elements", () => {
    render(<BookingListSkeleton />);
    const root = screen.getByTestId("booking-list-skeleton");
    const firstCard = root.children[0];
    // 2 row divs, each containing Skeleton elements
    expect(firstCard.children).toHaveLength(2);
  });

  it("matches snapshot", () => {
    const { container } = render(<BookingListSkeleton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
