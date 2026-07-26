import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/** Number of day columns in the calendar (Mon–Sun) */
const DAYS = 7;
/** Number of hour rows shown (08:00–19:00 inclusive) */
const HOURS = 12;

/**
 * Skeleton that mirrors the WorkspaceCalendar grid layout.
 *
 * Structure:
 *   - Header row: 1 time-label column + 7 day-name columns
 *   - Body: 12 hour rows × 7 day columns of slot buttons
 *
 * aria-hidden="true" is set on the root so screen readers skip the
 * placeholder entirely and wait for the real calendar to arrive.
 */
export function WorkspaceCalendarSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="workspace-calendar-skeleton"
      className="w-full overflow-x-auto"
    >
      {/* Week navigation bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-48 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `4rem repeat(${DAYS}, minmax(0, 1fr))`,
        }}
      >
        {/* Header row — blank time-label corner + day names */}
        <div /> {/* empty corner */}
        {Array.from({ length: DAYS }).map((_, d) => (
          <Skeleton key={`hdr-${d}`} className="h-6 mx-1 mb-2 rounded-md" />
        ))}

        {/* Body rows */}
        {Array.from({ length: HOURS }).map((_, h) => (
          <React.Fragment key={`row-${h}`}>
            {/* Time label cell */}
            <Skeleton className="h-9 w-12 mb-1 rounded-md" />

            {/* Slot cells for each day */}
            {Array.from({ length: DAYS }).map((_, d) => (
              <Skeleton
                key={`slot-${h}-${d}`}
                className="h-9 mx-1 mb-1 rounded-lg"
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-28 rounded-md" />
      </div>
    </div>
  );
}
