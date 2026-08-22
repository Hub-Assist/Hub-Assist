"use client";

import { useState, useCallback, useId } from "react";
import { cn } from "@/lib/cn";
import { useWorkspaceAvailability } from "@/lib/react-query/hooks/workspaces/useWorkspaceAvailability";
import { WorkspaceCalendarSkeleton } from "./WorkspaceCalendarSkeleton";
import { WorkspaceCalendarHeader } from "./calendar/WorkspaceCalendarHeader";
import { WorkspaceCalendarGrid } from "./calendar/WorkspaceCalendarGrid";
import { WorkspaceCalendarLegend } from "./calendar/WorkspaceCalendarLegend";
import {
  addDays,
  getLocalHour,
  getLocalWeekStart,
  toDatetimeLocalValue,
  toLocalDateString,
} from "@/utils/dateUtils";
import type { AvailabilitySlot } from "@/types/workspace";

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

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * WorkspaceCalendar
 *
 * Renders a 7-day × 12-hour CSS Grid showing hourly availability for a
 * workspace.  Each day's data is fetched independently via `useWorkspaceAvailability`
 * so React Query can cache and re-use individual day results.
 *
 * This component is the state/data container; the header, grid, and legend
 * are presentational sub-components under `./calendar/`.
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

  const [weekStart, setWeekStart] = useState<Date>(() => getLocalWeekStart(new Date()));
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
      hourMap.set(getLocalHour(slot.hour), slot);
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
        startTime: toDatetimeLocalValue(slotDate),
        endTime: toDatetimeLocalValue(endDate),
        slot,
      });
    },
    [onSlotSelect]
  );

  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToCurrentWeek = () => setWeekStart(getLocalWeekStart(new Date()));

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

  return (
    <section
      aria-labelledby={headingId}
      className={cn("w-full overflow-x-auto", className)}
      data-testid="workspace-calendar"
    >
      <WorkspaceCalendarHeader
        headingId={headingId}
        weekStart={weekStart}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
        onCurrentWeek={goToCurrentWeek}
      />

      <WorkspaceCalendarGrid
        weekDays={weekDays}
        weekDateStrings={weekDateStrings}
        slotMap={slotMap}
        selectedSlotKey={selectedSlotKey}
        onSlotSelect={handleSlotSelect}
        headingId={headingId}
      />

      <WorkspaceCalendarLegend id={legendId} />
    </section>
  );
}
