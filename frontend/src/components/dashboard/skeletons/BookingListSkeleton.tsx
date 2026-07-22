import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the BookingCard layout:
 *   rounded-2xl bg-[#F3EBE2] border p-4, flex-col gap-2 with two rows:
 *     Row 1 — workspace name (left) + status badge (right)
 *     Row 2 — date, time, amount chips
 *
 * Three cards match the typical "first page" of bookings to minimise CLS.
 */
export function BookingListSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3"
      data-testid="booking-list-skeleton"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] border border-[#D7CFC6] p-4"
        >
          {/* Row 1: workspace name + status badge */}
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          {/* Row 2: date / time / amount chips */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="ml-auto h-4 w-14 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
