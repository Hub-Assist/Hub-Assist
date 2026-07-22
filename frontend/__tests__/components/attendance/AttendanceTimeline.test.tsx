import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceTimeline } from "@/components/attendance/AttendanceTimeline";
import type { AttendanceRecord } from "@/lib/apiClient";
import * as csvExportModule from "@/utils/exportToCSV";

// Mock exportToCSV module
jest.mock("@/utils/exportToCSV", () => ({
  ...jest.requireActual("@/utils/exportToCSV"),
  exportToCSV: jest.fn(),
}));

describe("AttendanceTimeline Component", () => {
  const mockRecords: AttendanceRecord[] = [
    {
      id: "rec-1",
      memberName: "John Doe",
      date: "2026-07-20",
      clockIn: "2026-07-20T09:00:00.000Z",
      clockOut: "2026-07-20T17:00:00.000Z",
    },
    {
      id: "rec-2",
      memberName: "John Doe",
      date: "2026-07-21",
      clockIn: "2026-07-21T10:00:00.000Z",
      clockOut: "2026-07-21T14:30:00.000Z",
    },
    {
      id: "rec-3",
      memberName: "Jane Smith",
      date: "2026-07-13", // Previous week (Week 29)
      clockIn: "2026-07-13T08:30:00.000Z",
      clockOut: "2026-07-13T16:30:00.000Z",
      isAnomaly: true,
      anomalyReason: "Flagged manual entry",
    },
  ];

  const defaultProps = {
    records: mockRecords,
    showMember: true,
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    onStartDateChange: jest.fn(),
    onEndDateChange: jest.fn(),
    activePreset: "30d" as const,
    onPresetSelect: jest.fn(),
    onResetFilters: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Grouping & Layout", () => {
    it("groups attendance records by ISO week and day chronologically", () => {
      render(<AttendanceTimeline {...defaultProps} />);

      // Week headers for Week 30 and Week 29
      expect(screen.getByText(/Week 30/)).toBeInTheDocument();
      expect(screen.getByText(/Week 29/)).toBeInTheDocument();

      // Day group headings
      expect(screen.getByText(/Monday, Jul 20, 2026/)).toBeInTheDocument();
    });

    it("displays correct duration bars and accessible aria-labels", () => {
      render(<AttendanceTimeline {...defaultProps} />);

      // Find session bars by aria-label
      const sessionArticles = screen.getAllByRole("article", {
        name: /Attendance session for John Doe/i,
      });

      expect(sessionArticles.length).toBeGreaterThan(0);
      expect(sessionArticles[0]).toHaveTextContent("4h 30m");
      expect(sessionArticles[1]).toHaveTextContent("8h 0m");
    });

    it("renders visual anomaly badges and highlights without relying on color alone", async () => {
      render(<AttendanceTimeline {...defaultProps} />);

      // Expand Week 29 group
      const week29Button = screen.getByRole("button", { name: /Week 29/i });
      await userEvent.click(week29Button);

      // Check anomaly badge and reason for rec-3
      const anomalyBadges = screen.getAllByText(/anomaly/i);
      expect(anomalyBadges.length).toBeGreaterThan(0);
      expect(screen.getByText("Flagged manual entry")).toBeInTheDocument();
    });
  });

  describe("Filtering & Presets", () => {
    it("calls onPresetSelect when a preset button is clicked", async () => {
      render(<AttendanceTimeline {...defaultProps} />);

      const preset7d = screen.getByRole("button", { name: "Last 7 Days" });
      await userEvent.click(preset7d);

      expect(defaultProps.onPresetSelect).toHaveBeenCalledWith("7d");
    });

    it("renders empty state when no records match filter", () => {
      render(<AttendanceTimeline {...defaultProps} records={[]} />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("No attendance records found.")).toBeInTheDocument();
    });

    it("calls onResetFilters when Reset button is clicked", async () => {
      render(<AttendanceTimeline {...defaultProps} records={[]} />);

      const resetBtn = screen.getByRole("button", { name: "Reset Filters" });
      await userEvent.click(resetBtn);

      expect(defaultProps.onResetFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe("CSV Export", () => {
    it("triggers CSV export function when Export CSV button is clicked", async () => {
      render(<AttendanceTimeline {...defaultProps} />);

      const exportBtn = screen.getByRole("button", {
        name: /Export visible attendance records to RFC 4180 CSV/i,
      });

      await userEvent.click(exportBtn);

      expect(csvExportModule.exportToCSV).toHaveBeenCalledTimes(1);
    });
  });

  describe("Performance & Virtualization (> 100 records)", () => {
    it("limits rendered week groups for large datasets (>100 records) and shows load more button", () => {
      // Generate 120 records spanning across 30 different weeks
      const largeRecords: AttendanceRecord[] = Array.from({ length: 120 }, (_, i) => {
        const d = new Date(2026, 0, 1 + i * 2); // dates spanning many weeks
        const iso = d.toISOString();
        return {
          id: `large-rec-${i}`,
          memberName: `User ${i}`,
          date: iso.slice(0, 10),
          clockIn: iso,
          clockOut: new Date(d.getTime() + 4 * 3600000).toISOString(),
        };
      });

      render(
        <AttendanceTimeline
          {...defaultProps}
          records={largeRecords}
          startDate="2025-01-01"
          endDate="2027-01-01"
        />
      );

      // Check load more button is displayed
      const loadMoreBtn = screen.getByRole("button", { name: /Load More Weeks/i });
      expect(loadMoreBtn).toBeInTheDocument();

      // Click load more button to expand windowing
      fireEvent.click(loadMoreBtn);
      expect(screen.getByRole("button", { name: /Load More Weeks/i })).toBeInTheDocument();
    });
  });
});
