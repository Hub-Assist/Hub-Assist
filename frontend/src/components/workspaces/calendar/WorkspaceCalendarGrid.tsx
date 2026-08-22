"use client";

import { cn } from "@/lib/cn";
import { formatLocalTime, getLocalHour, toLocalDateString } from "@/utils/dateUtils";
import type { AvailabilitySlot } from "@/types/workspace";

// ─── Operating hours ──────────────────────────────────────────────────────────
/** First operating hour (UTC), inclusive */
export const OPERATING_START = 8;
/** Last operating hour (UTC), exclusive (so 20 → last visible slot is 19:00) */
export const OPERATING_END = 20;
/** Number of visible hour rows */
export const HOUR_COUNT = OPERATING_END - OPERATING_START; // 12

// ─── SlotButton ───────────────────────────────────────────────────────────────

interface SlotButtonProps {
  slot: AvailabilitySlot;
  onSelect: (slot: AvailabilitySlot) => void;
  isSelected: boolean;
  labelledById: string;
}

function SlotButton({ slot, onSelect, isSelected, labelledById }: SlotButtonProps) {
  const isAvailable = slot.available > 0;
  const isOutsideHours =
    getLocalHour(slot.hour) < OPERATING_START ||
    getLocalHour(slot.hour) >= OPERATING_END;

  if (isOutsideHours) {
    return (
      <div
        aria-hidden="true"
        className="h-9 mx-1 mb-1 rounded-lg bg-gray-100 opacity-40"
      />
    );
  }

  const label = isAvailable
    ? `${formatLocalTime(slot.hour)}: ${slot.available} of ${slot.capacity} seats available. Click to book.`
    : `${formatLocalTime(slot.hour)}: fully booked.`;

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

// ─── WorkspaceCalendarGrid ──────────────────────────────────────────────────

export interface WorkspaceCalendarGridProps {
  /** The 7 dates (Mon–Sun, local time) currently displayed. */
  weekDays: Date[];
  /** `weekDays` pre-formatted as local YYYY-MM-DD strings (same order). */
  weekDateStrings: string[];
  /** localDateString → localHour → slot, built by the parent from the day queries. */
  slotMap: Map<string, Map<number, AvailabilitySlot>>;
  selectedSlotKey: string | null;
  onSlotSelect: (slot: AvailabilitySlot) => void;
  /** Id of the "Availability" heading, used to associate slot buttons with it. */
  headingId: string;
}

/**
 * Renders the 7-day × 12-hour CSS Grid of hourly availability slots.
 */
export function WorkspaceCalendarGrid({
  weekDays,
  weekDateStrings,
  slotMap,
  selectedSlotKey,
  onSlotSelect,
  headingId,
}: WorkspaceCalendarGridProps) {
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
        const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day);
        const dayNum = day.getDate();
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
          <div key={`row-${rowIdx}`} role="row" className="contents">
            {/* Time label */}
            <div
              role="rowheader"
              className="pr-2 text-right text-xs text-gray-400 leading-9 select-none whitespace-nowrap"
              aria-label={label}
            >
              <span aria-hidden="true">{label}</span>
            </div>

            {/* Slot buttons for each day */}
            {weekDays.map((_day, colIdx) => {
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
                <div key={`cell-${rowIdx}-${colIdx}`} role="gridcell">
                  <SlotButton
                    slot={slot}
                    onSelect={onSlotSelect}
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
  );
}
