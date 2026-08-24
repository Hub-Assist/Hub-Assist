import type { AttendanceRecord } from "@/lib/apiClient";

/**
 * Returns the ISO 8601 week number for a given date.
 * ISO week 1 is the week with the year's first Thursday.
 */
export function getISOWeek(dateInput: Date | string): number {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 1;

  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // Thursday of current week
  const firstThursday = new Date(target.getUTCFullYear(), 0, 4);
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3);

  const weekDiff = (target.getTime() - firstThursday.getTime()) / (86400000 * 7);
  return 1 + Math.round(weekDiff);
}

/**
 * Returns the ISO 8601 week year for a given date.
 */
export function getISOWeekYear(dateInput: Date | string): number {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return new Date().getUTCFullYear();

  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  return target.getUTCFullYear();
}

/**
 * Returns a unique key string for the ISO week (e.g., "2026-W30").
 */
export function getISOWeekKey(dateInput: Date | string): string {
  const year = getISOWeekYear(dateInput);
  const week = getISOWeek(dateInput);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

/**
 * Returns the start (Monday) and end (Sunday) dates for an ISO week given any date in that week.
 */
export function getISOWeekBounds(dateInput: Date | string): { start: Date; end: Date } {
  const date = new Date(dateInput);
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6

  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Formats an ISO week range into a human readable label (e.g. "Week 30 • Jul 20 – Jul 26, 2026").
 */
export function getISOWeekRangeLabel(dateInput: Date | string): string {
  const week = getISOWeek(dateInput);
  const { start, end } = getISOWeekBounds(dateInput);

  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endDay = end.getUTCDate();
  const year = end.getUTCFullYear();

  const rangeStr = `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;

  return `Week ${week} • ${rangeStr}`;
}

/**
 * Calculates session duration in minutes and formatted string.
 */
export function calculateDuration(
  clockIn: string,
  clockOut?: string
): { minutes: number; formatted: string; isCompleted: boolean } {
  const start = new Date(clockIn).getTime();
  if (isNaN(start)) {
    return { minutes: 0, formatted: "—", isCompleted: false };
  }

  if (!clockOut) {
    const elapsedMins = Math.max(0, Math.round((Date.now() - start) / 60000));
    return { minutes: elapsedMins, formatted: "Active", isCompleted: false };
  }

  const end = new Date(clockOut).getTime();
  if (isNaN(end) || end < start) {
    return { minutes: 0, formatted: "Invalid", isCompleted: false };
  }

  const mins = Math.round((end - start) / 60000);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  let formatted = "";
  if (hours > 0) {
    formatted = `${hours}h ${remainingMins}m`;
  } else {
    formatted = `${remainingMins}m`;
  }

  return { minutes: mins, formatted, isCompleted: true };
}

/**
 * Evaluates whether an attendance record has an anomaly.
 */
export function isAnomalyRecord(record: AttendanceRecord): { isAnomaly: boolean; reason?: string } {
  if (record.isAnomaly) {
    return { isAnomaly: true, reason: record.anomalyReason ?? "Flagged anomaly" };
  }

  if (record.autoCompleted) {
    return { isAnomaly: true, reason: record.autoCompletedReason ?? "Auto-completed due to inactivity" };
  }

  // Check for missing clockOut on past dates
  if (!record.clockOut) {
    const today = new Date().toISOString().slice(0, 10);
    const recordDate = record.date || record.clockIn.slice(0, 10);
    if (recordDate < today) {
      return { isAnomaly: true, reason: "Missing clock-out for past date" };
    }
  }

  // Check duration bounds if clockOut is present
  if (record.clockIn && record.clockOut) {
    const { minutes } = calculateDuration(record.clockIn, record.clockOut);
    if (minutes > 720) { // Exceeds 12 hours
      return { isAnomaly: true, reason: `Excessive session length (${Math.round(minutes / 60)}h)` };
    }
    if (minutes < 1) { // Under 1 minute
      return { isAnomaly: true, reason: "Sub-minute session duration" };
    }
  }

  return { isAnomaly: false };
}

/**
 * Formats date string into human readable day label (e.g., "Monday, Jul 20, 2026").
 */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats timestamp into locale-independent time label in UTC (e.g., "02:30 PM").
 */
export function formatTimeLabel(isoStr?: string): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

// ─── Local time-zone helpers ────────────────────────────────────────────────
//
// The helpers above format dates in UTC (used for attendance records, which
// are day-bucketed server-side). The helpers below instead operate in the
// user's local time zone — used by calendar-style UI (e.g. WorkspaceCalendar)
// where slot times must be shown as the local wall-clock time.

/** Adds `days` calendar days to `date` in local time (returns a new Date). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns a YYYY-MM-DD string for the given Date in the user's local time zone.
 * Uses Intl.DateTimeFormat to avoid manual offset arithmetic.
 */
export function toLocalDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // en-CA produces YYYY-MM-DD
}

/** Returns Monday of the local calendar week that contains `date`. */
export function getLocalWeekStart(date: Date): Date {
  const d = new Date(date);
  // getDay(): 0=Sun … 6=Sat → Monday offset
  const dayOfWeek = d.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7; // 0 for Mon, 6 for Sun
  d.setDate(d.getDate() - distanceToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Converts a UTC ISO timestamp to the local hour (0–23) in the viewer's
 * time zone, e.g. for placing a slot in the correct row of a calendar grid.
 */
export function getLocalHour(isoString: string): number {
  return new Date(isoString).getHours();
}

/**
 * Formats a UTC ISO timestamp into the user's local time zone as a short
 * time label, e.g. "8:00 AM".
 */
export function formatLocalTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

/**
 * Formats a Date as a short weekday + day-of-month, for a calendar column
 * header. e.g. { weekday: "Mon", day: 28 }
 */
export function formatLocalDayHeader(date: Date): { weekday: string; day: number } {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  return { weekday, day: date.getDate() };
}

/**
 * Formats a local week-start Date into a human-readable range label, e.g.
 * "Jul 28 – Aug 3, 2026".
 */
export function formatLocalWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(weekStart);
  const endLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(weekEnd);
  return `${startLabel} – ${endLabel}`;
}

/**
 * Formats a local Date into a `datetime-local` input value (YYYY-MM-DDTHH:mm).
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
