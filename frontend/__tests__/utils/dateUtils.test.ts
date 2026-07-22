import {
  getISOWeek,
  getISOWeekYear,
  getISOWeekKey,
  getISOWeekRangeLabel,
  calculateDuration,
  isAnomalyRecord,
  formatDateLabel,
  formatTimeLabel,
} from "@/utils/dateUtils";
import type { AttendanceRecord } from "@/lib/apiClient";

describe("dateUtils", () => {
  describe("ISO Week Grouping", () => {
    it("correctly calculates ISO week numbers", () => {
      // 2026-07-20 is a Monday in week 30 of 2026
      expect(getISOWeek("2026-07-20T10:00:00Z")).toBe(30);
      expect(getISOWeekYear("2026-07-20T10:00:00Z")).toBe(2026);
      expect(getISOWeekKey("2026-07-20T10:00:00Z")).toBe("2026-W30");
    });

    it("formats ISO week range labels properly", () => {
      const label = getISOWeekRangeLabel("2026-07-20T10:00:00Z");
      expect(label).toContain("Week 30");
      expect(label).toMatch(/Jul 20/);
      expect(label).toMatch(/Jul 26/);
    });
  });

  describe("calculateDuration", () => {
    it("returns formatted active status for open sessions", () => {
      const result = calculateDuration("2026-07-20T09:00:00Z");
      expect(result.formatted).toBe("Active");
      expect(result.isCompleted).toBe(false);
    });

    it("calculates completed session duration in hours and minutes", () => {
      const result = calculateDuration("2026-07-20T09:00:00Z", "2026-07-20T12:45:00Z");
      expect(result.minutes).toBe(225);
      expect(result.formatted).toBe("3h 45m");
      expect(result.isCompleted).toBe(true);
    });

    it("handles sessions under 1 hour", () => {
      const result = calculateDuration("2026-07-20T09:00:00Z", "2026-07-20T09:30:00Z");
      expect(result.minutes).toBe(30);
      expect(result.formatted).toBe("30m");
    });
  });

  describe("isAnomalyRecord", () => {
    it("identifies explicit anomaly flag", () => {
      const rec: AttendanceRecord = {
        id: "1",
        date: "2026-07-20",
        clockIn: "2026-07-20T09:00:00Z",
        isAnomaly: true,
        anomalyReason: "Manual flag",
      };
      const result = isAnomalyRecord(rec);
      expect(result.isAnomaly).toBe(true);
      expect(result.reason).toBe("Manual flag");
    });

    it("identifies auto-completed sessions", () => {
      const rec: AttendanceRecord = {
        id: "2",
        date: "2026-07-20",
        clockIn: "2026-07-20T09:00:00Z",
        autoCompleted: true,
        autoCompletedReason: "Timeout after 12h",
      };
      const result = isAnomalyRecord(rec);
      expect(result.isAnomaly).toBe(true);
      expect(result.reason).toBe("Timeout after 12h");
    });

    it("flags missing clock-out for past dates", () => {
      const rec: AttendanceRecord = {
        id: "3",
        date: "2026-01-01",
        clockIn: "2026-01-01T09:00:00Z",
      };
      const result = isAnomalyRecord(rec);
      expect(result.isAnomaly).toBe(true);
      expect(result.reason).toBe("Missing clock-out for past date");
    });

    it("flags excessive session duration (>12h)", () => {
      const rec: AttendanceRecord = {
        id: "4",
        date: "2026-07-20",
        clockIn: "2026-07-20T06:00:00Z",
        clockOut: "2026-07-20T22:00:00Z", // 16 hours
      };
      const result = isAnomalyRecord(rec);
      expect(result.isAnomaly).toBe(true);
      expect(result.reason).toMatch(/Excessive session length/);
    });

    it("returns normal for valid completed session", () => {
      const rec: AttendanceRecord = {
        id: "5",
        date: "2026-07-20",
        clockIn: "2026-07-20T09:00:00Z",
        clockOut: "2026-07-20T17:00:00Z",
      };
      expect(isAnomalyRecord(rec).isAnomaly).toBe(false);
    });
  });

  describe("formatting helpers", () => {
    it("formats date label accurately", () => {
      const label = formatDateLabel("2026-07-20");
      expect(label).toMatch(/Monday/);
      expect(label).toMatch(/Jul 20, 2026/);
    });

    it("formats time label accurately", () => {
      const timeStr = formatTimeLabel("2026-07-20T14:30:00Z");
      expect(timeStr).toMatch(/02:30 PM|2:30 PM/);
    });
  });
});
