import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the ActivityFeed layout:
 *   flex-col gap-2, each row is rounded-xl bg-[#F3EBE2] px-4 py-3
 *   containing: icon · description text · timestamp.
 *
 * Uses the same row count (4) as the typical API response so the
 * list height is consistent and CLS is avoided.
 */
export function ActivityFeedSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-2"
      data-testid="activity-feed-skeleton"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-[#F3EBE2] px-4 py-3"
        >
          {/* Icon placeholder */}
          <Skeleton className="h-5 w-5 shrink-0 rounded-full" />

          {/* Description text */}
          <Skeleton className="h-4 flex-1 rounded-md" />

          {/* Timestamp */}
          <Skeleton className="h-3 w-12 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
