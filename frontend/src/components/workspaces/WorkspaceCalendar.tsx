"use client";

import { useState, useCallback, useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWorkspaceAvailability } from "@/lib/react-query/hooks/workspaces/useWorkspaceAvailability";
import { WorkspaceCalendarSkeleton } from "./WorkspaceCalendarSkeleton";
import type { AvailabilitySlot } from "@/types/workspace";

// ─── Operating hours ──────────────────────────────────────────────────────────
/** First operating hour (UTC), inclusive */
const OPERATING_START = 8;
/** Last operating hour (UTC), exclusive (so 20 → last visible slot is 19:00) */
const OPERATING_END = 20;
/** Number of visible hour rows */
const HOUR_COUNT = OPERATING_END - OPERATING_START; // 12

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD string for the given Date in the user's local time zone.
 * We use Intl.DateTimeFormat to avoid manual offset arithmetic.
 */
function toLocalDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // en-CA produces YYYY-MM-DD
}

/**
 * Returns Monday of the ISO week that contains `date`, in local time.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  // getDay(): 0=Sun … 6=Sat → Monday offset
  const dayOfWeek = d.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7; // 0 for Mon, 6 for Sun
  d.setDate(d.getDate() - distanceToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Adds `days` calendar days to `date` (returns a new Date). */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Formats a UTC ISO slot timestamp into the user's local time zone for display.
 * e.g. "2026-07-28T08:00:00.000Z" → "8:00 AM" in the local TZ.
 */
function formatSlotTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

/**
 * Formats a Date as a short weekday + date label for the column header.
 * e.g. Mon 28
 */
function formatDayHeader(date: Date): { weekday: string; day: number } {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  return { weekday, day: date.getDate() };
}

/**
 * Formats a Date to a human-readable week range label, e.g.
 * "Jul 28 – Aug 3, 2026"
 */
function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(weekStart);
  const endLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(weekEnd);
  return `${startLabel} – ${endLabel}`;
}

/**
 * Converts a slot's UTC ISO timestamp to the local YYYY-MM-DD date string so
 * we can group slots by the day they appear in the user's time zone.
 */
function slotLocalDate(isoString: string): string {
  return toLocalDateString(new Date(isoString));
}

/**
 * Converts a slot's UTC ISO timestamp to the local hour (0–23) so we can
 * place the slot in the correct row of the grid.
 */
function slotLocalHour(isoString: string): number {
  return new Date(isoString).getHours();
}

/**
 * Formats a local Date into a datetime-local string (YYYY-MM-DDTHH:mm).
 * Used to pre-fill the BookingForm's `datetime-local` inputs.
 */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotSelection {
  /** datetime-local string for the start of the selected hour (local time) */
  startTime: string;
  /** datetime-local string for the end of the selected hour (local time) */
  endTime: string;
  /** The raw availability slot that was clicked */
  slot: AvailabilitySlot;
}

export interface WorkspaceCalendarProps {
  /** UUID of the workspace whose availability to display */
  workspaceId: string;
  /**
   * Called when the user clicks an available time slot.
   * Receives pre-formatted startTime / endTime strings suitable for a
   * `<input type="datetime-local">` input.
   */
  onSlotSelect?: (selection: SlotSelection) => void;
  /** Optional additional class names for the root wrapper */
  className?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SlotButtonProps {
  slot: AvailabilitySlot;
  onSelect: (slot: AvailabilitySlot) => void;
  isSelected: boolean;
  labelledById: string;
}

function SlotButton({ slot, onSelect, isSelected, labelledById }: SlotButtonProps) {
  const isAvailable = slot.available > 0;
  const isOutsideHours =
    slotLocalHour(slot.hour) < OPERATING_START ||
    slotLocalHour(slot.hour) >= OPERATING_END;

  if (isOutsideHours) {
    return (
      <div
        aria-hidden="true"
        className="h-9 mx-1 mb-1 rounded-lg bg-gray-100 opacity-40"
      />
    );
  }

  const label = isAvailable
    ? `${formatSlotTime(slot.hour)}: ${slot.available} of ${slot.capacity} seats available. Click to book.`
    : `${formatSlotTime(slot.hour)}: fully booked.`;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => isAvailable && onSelect(slot)}
      aria-label={label}
      aria-describedby={labelledById}
      aria-pressed={isSelected}
      data-testid="calendar-slot"
      className={cn(
        "h-9 mx-1 mb-1 rounded-lg text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        isAvailable
          ? cn(
              "focus-visible:ring-green-500 cursor-pointer",
              isSelected
                ? "bg-green-600 text-white ring-2 ring-green-600 ring-offset-1"
                : "bg-green-100 text-green-800 hover:bg-green-200"
            )
          : "bg-red-100 text-red-700 cursor-not-allowed opacity-80 focus-visible:ring-red-400"
      )}
    >
      <span className="sr-only">{label}</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * WorkspaceCalendar
 *
 * Renders a 7-day × 12-hour CSS Grid showing hourly availability for a
 * workspace.  Each day's data is fetched independently via `useWorkspaceAvailability`
 * so React Query can cache and re-use individual day results.
 *
 * Accessibility:
 * - All slot buttons carry an `aria-label` describing the time and availability.
 * - Disabled (booked) slots are rendered as `<button disabled>` so AT announces
 *   them as unavailable without being interactive.
 * - The week navigation buttons have descriptive `aria-label` attributes.
 * - The grid is wrapped in a `<section>` with an accessible heading.
 */
export function WorkspaceCalendar({
  workspaceId,
  onSlotSelect,
  className,
}: WorkspaceCalendarProps) {
  const headingId = useId();
  const legendId = useId();

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  // Build an array of 7 Date objects for the current week (Mon–Sun local time)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Pre-format the date strings we'll pass to the API (YYYY-MM-DD, local)
  const weekDateStrings = weekDays.map(toLocalDateString);

  // Fetch availability for each day independently
  const dayQueries = weekDays.map((day) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- stable array, see NOTE below
    return useWorkspaceAvailability(workspaceId, toLocalDateString(day));
  });
  // NOTE: The array length is always exactly 7 (constant), so the hook call
  // order is stable across renders — this is intentional and safe.

  const isLoadingAny = dayQueries.some((q) => q.isLoading);
  const isErrorAny = dayQueries.some((q) => q.isError);

  // Build a lookup map: localDateString → localHour → AvailabilitySlot
  const slotMap = new Map<string, Map<number, AvailabilitySlot>>();
  dayQueries.forEach((q, i) => {
    if (!q.data) return;
    const dateStr = weekDateStrings[i];
    const hourMap = new Map<number, AvailabilitySlot>();
    q.data.forEach((slot) => {
      hourMap.set(slotLocalHour(slot.hour), slot);
    });
    slotMap.set(dateStr, hourMap);
  });

  const handleSlotSelect = useCallback(
    (slot: AvailabilitySlot) => {
      const key = slot.hour;
      setSelectedSlotKey((prev) => (prev === key ? null : key));

      const slotDate = new Date(slot.hour);
      const endDate = new Date(slotDate.getTime() + 60 * 60 * 1000); // +1 hour
      onSlotSelect?.({
        startTime: toDatetimeLocal(slotDate),
        endTime: toDatetimeLocal(endDate),
        slot,
      });
    },
    [onSlotSelect]
  );

  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToCurrentWeek = () => setWeekStart(getWeekStart(new Date()));

  if (isLoadingAny) {
    return <WorkspaceCalendarSkeleton />;
  }

  if (isErrorAny) {
    return (
      <div
        role="alert"
        className="p-4 rounded-lg bg-red-50 text-red-700 text-sm text-center"
      >
        Failed to load availability. Please try again.
      </div>
    );
  }

  // Hour labels for the time-axis (left column)
  const hourLabels = Array.from({ length: HOUR_COUNT }, (_, i) => {
    const hour = OPERATING_START + i;
    // Format as "8 AM", "12 PM", etc. using user's locale
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      hour12: true,
    }).format(new Date(2000, 0, 1, hour, 0, 0));
  });

  return (
    <section
      aria-labelledby={headingId}
      className={cn("w-full overflow-x-auto", className)}
      data-testid="workspace-calendar"
    >
      {/* ── Heading & week navigation ── */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2
          id={headingId}
          className="text-base font-semibold text-gray-900 whitespace-nowrap"
        >
          Availability
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevWeek}
            aria-label="Previous week"
            className="p-1.5 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={goToCurrentWeek}
            data-testid="week-range-btn"
            className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded px-1"
          >
            {formatWeekRange(weekStart)}
          </button>

          <button
            type="button"
            onClick={goToNextWeek}
            aria-label="Next week"
            className="p-1.5 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── CSS Grid ── */}
      <div
        role="grid"
        aria-label="Workspace availability calendar"
        className="grid"
        style={{ gridTemplateColumns: `4rem repeat(7, minmax(0, 1fr))` }}
      >
        {/* ── Header row ── */}
        <div role="rowheader" className="sr-only">
          Time
        </div>
        {weekDays.map((day, d) => {
          const { weekday, day: dayNum } = formatDayHeader(day);
          const isToday =
            toLocalDateString(day) === toLocalDateString(new Date());
          return (
            <div
              key={`hdr-${d}`}
              role="columnheader"
              aria-label={new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(day)}
              className={cn(
                "text-center text-xs font-medium pb-2 select-none",
                isToday ? "text-green-700" : "text-gray-500"
              )}
            >
              <span aria-hidden="true">{weekday}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs",
                  isToday && "bg-green-600 text-white font-bold"
                )}
              >
                {dayNum}
              </span>
            </div>
          );
        })}

        {/* ── Body rows ── */}
        {hourLabels.map((label, rowIdx) => {
          const localHour = OPERATING_START + rowIdx;
          return (
            <div
              key={`row-${rowIdx}`}
              role="row"
              className="contents"
            >
              {/* Time label */}
              <div
                role="rowheader"
                className="pr-2 text-right text-xs text-gray-400 leading-9 select-none whitespace-nowrap"
                aria-label={label}
              >
                <span aria-hidden="true">{label}</span>
              </div>

              {/* Slot buttons for each day */}
              {weekDays.map((day, colIdx) => {
                const dateStr = weekDateStrings[colIdx];
                const slot = slotMap.get(dateStr)?.get(localHour);

                if (!slot) {
                  // Data not yet available for this cell (or day outside returned range)
                  return (
                    <div
                      key={`cell-${rowIdx}-${colIdx}`}
                      role="gridcell"
                      aria-busy="true"
                      className="h-9 mx-1 mb-1 rounded-lg bg-gray-100 animate-pulse"
                    />
                  );
                }

                return (
                  <div
                    key={`cell-${rowIdx}-${colIdx}`}
                    role="gridcell"
                  >
                    <SlotButton
                      slot={slot}
                      onSelect={handleSlotSelect}
                      isSelected={selectedSlotKey === slot.hour}
                      labelledById={headingId}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div
        id={legendId}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500"
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded bg-green-200 border border-green-400"
          />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded bg-red-200 border border-red-400"
          />
          Fully booked
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded bg-gray-100 border border-gray-300"
          />
          Outside operating hours
        </span>
      </div>
    </section>
  );
}
