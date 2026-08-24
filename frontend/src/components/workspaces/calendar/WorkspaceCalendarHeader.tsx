"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatLocalWeekRange } from "@/utils/dateUtils";

export interface WorkspaceCalendarHeaderProps {
  /** Element id of the "Availability" heading, referenced by the parent `<section aria-labelledby>`. */
  headingId: string;
  /** Monday of the currently displayed week (local time). */
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
}

/**
 * Heading + week-navigation controls for WorkspaceCalendar.
 */
export function WorkspaceCalendarHeader({
  headingId,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
}: WorkspaceCalendarHeaderProps) {
  return (
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
          onClick={onPrevWeek}
          aria-label="Previous week"
          className="p-1.5 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onCurrentWeek}
          data-testid="week-range-btn"
          className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded px-1"
        >
          {formatLocalWeekRange(weekStart)}
        </button>

        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Next week"
          className="p-1.5 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
