import type { AttendanceRecord } from "@/lib/apiClient";
import { calculateDuration, isAnomalyRecord, formatTimeLabel } from "./dateUtils";

/**
 * Escapes a single CSV cell value according to RFC 4180 standard.
 * If the value contains double quotes, commas, or line breaks (\r or \n),
 * it is wrapped in double quotes and any internal double quotes are doubled ("").
 */
export function escapeCSVCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) {
    return "";
  }
  const str = String(val);
  const needsQuoting = /[",\r\n]/.test(str);
  if (needsQuoting) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a raw timestamp string into an ISO 8601 UTC string format (e.g. "2026-07-20T09:00:00.000Z").
 */
export function formatUTCTimestamp(isoStr?: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

/**
 * Generates RFC 4180-compliant CSV string content from attendance records.
 * Lines are joined by CRLF (\r\n).
 */
export function generateCSVContent(records: AttendanceRecord[]): string {
  const headers = [
    "Member Name",
    "Date",
    "Clock In",
    "Clock Out",
    "Duration (minutes)",
    "Duration (formatted)",
    "Status",
    "Anomaly Reason",
    "UTC Clock In",
    "UTC Clock Out",
  ];

  const headerRow = headers.map(escapeCSVCell).join(",");

  if (!records || records.length === 0) {
    return `${headerRow}\r\n`;
  }

  const dataRows = records.map((record) => {
    const { isAnomaly, reason } = isAnomalyRecord(record);
    const { minutes, formatted } = calculateDuration(record.clockIn, record.clockOut);
    const status = isAnomaly ? "Anomaly" : !record.clockOut ? "Active" : "Normal";

    const memberName = record.memberName ?? "—";
    const date = record.date || (record.clockIn ? record.clockIn.slice(0, 10) : "");
    const clockInFormatted = formatTimeLabel(record.clockIn);
    const clockOutFormatted = formatTimeLabel(record.clockOut);
    const utcClockIn = formatUTCTimestamp(record.clockIn);
    const utcClockOut = formatUTCTimestamp(record.clockOut);

    const rowValues = [
      memberName,
      date,
      clockInFormatted,
      clockOutFormatted,
      minutes,
      formatted,
      status,
      reason ?? "",
      utcClockIn,
      utcClockOut,
    ];

    return rowValues.map(escapeCSVCell).join(",");
  });

  return [headerRow, ...dataRows].join("\r\n") + "\r\n";
}

/**
 * Generates and triggers a browser download for the attendance CSV report.
 */
export function exportToCSV(records: AttendanceRecord[], filename = "attendance_report.csv"): void {
  const csvContent = generateCSVContent(records);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  type LegacyNavigator = { msSaveOrOpenBlob?: (blob: Blob, filename?: string) => void };
  if (typeof window !== "undefined" && window.navigator && (window.navigator as unknown as LegacyNavigator).msSaveOrOpenBlob) {
    // Legacy IE/Edge support
    (window.navigator as unknown as LegacyNavigator).msSaveOrOpenBlob!(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
