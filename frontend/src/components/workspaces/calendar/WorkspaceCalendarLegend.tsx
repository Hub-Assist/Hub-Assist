export interface WorkspaceCalendarLegendProps {
  /** Element id set on the legend list, for future `aria-describedby` wiring. */
  id: string;
}

/**
 * Colour-coded legend explaining the slot states shown in WorkspaceCalendarGrid.
 */
export function WorkspaceCalendarLegend({ id }: WorkspaceCalendarLegendProps) {
  return (
    <div
      id={id}
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
  );
}
