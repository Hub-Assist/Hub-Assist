import {
  escapeCSVCell,
  formatUTCTimestamp,
  generateCSVContent,
} from "@/utils/exportToCSV";
import type { AttendanceRecord } from "@/lib/apiClient";

describe("exportToCSV Utility", () => {
  describe("escapeCSVCell", () => {
    it("returns empty string for null and undefined", () => {
      expect(escapeCSVCell(null)).toBe("");
      expect(escapeCSVCell(undefined)).toBe("");
    });

    it("leaves simple text unquoted", () => {
      expect(escapeCSVCell("John Doe")).toBe("John Doe");
      expect(escapeCSVCell(123)).toBe("123");
    });

    it("escapes fields containing commas", () => {
      expect(escapeCSVCell("Doe, John")).toBe('"Doe, John"');
    });

    it("escapes fields containing double quotes by doubling them", () => {
      expect(escapeCSVCell('John "The Great"')).toBe('"John ""The Great"""');
    });

    it("escapes multiline values containing newlines", () => {
      expect(escapeCSVCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCSVCell("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe("formatUTCTimestamp", () => {
    it("converts ISO date string to raw UTC ISO format", () => {
      const utcStr = formatUTCTimestamp("2026-07-20T10:00:00Z");
      expect(utcStr).toBe("2026-07-20T10:00:00.000Z");
    });

    it("returns empty string for invalid timestamp", () => {
      expect(formatUTCTimestamp("invalid-date")).toBe("");
      expect(formatUTCTimestamp(undefined)).toBe("");
    });
  });

  describe("generateCSVContent", () => {
    it("handles empty dataset cleanly with header row", () => {
      const csv = generateCSVContent([]);
      expect(csv).toContain(
        "Member Name,Date,Clock In,Clock Out,Duration (minutes),Duration (formatted),Status,Anomaly Reason,UTC Clock In,UTC Clock Out"
      );
      expect(csv.endsWith("\r\n")).toBe(true);
    });

    it("generates correct data rows with RFC 4180 CRLF line endings", () => {
      const records: AttendanceRecord[] = [
        {
          id: "rec-1",
          memberName: "Alice, Smith",
          date: "2026-07-20",
          clockIn: "2026-07-20T09:00:00.000Z",
          clockOut: "2026-07-20T17:00:00.000Z",
        },
      ];

      const csv = generateCSVContent(records);
      const lines = csv.split("\r\n").filter(Boolean);

      expect(lines.length).toBe(2); // Header + 1 Data row
      expect(lines[1]).toContain('"Alice, Smith"');
      expect(lines[1]).toContain("2026-07-20T09:00:00.000Z");
      expect(lines[1]).toContain("2026-07-20T17:00:00.000Z");
    });

    it("correctly includes anomaly status and reasons in CSV export", () => {
      const records: AttendanceRecord[] = [
        {
          id: "rec-2",
          memberName: 'Bob "Builder" Jones',
          date: "2026-07-20",
          clockIn: "2026-07-20T08:00:00.000Z",
          autoCompleted: true,
          autoCompletedReason: "Timeout after inactivity",
        },
      ];

      const csv = generateCSVContent(records);
      expect(csv).toContain('"Bob ""Builder"" Jones"');
      expect(csv).toContain("Anomaly");
      expect(csv).toContain("Timeout after inactivity");
    });
  });
});
