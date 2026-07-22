import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the StatsCards layout:
 *   grid-cols-2 lg:grid-cols-4, gap-4, 4 × h-28 rounded-2xl cards.
 *
 * Dimensions are identical to StatCard so there is no layout shift
 * when real content replaces this placeholder.
 */
export function StatsCardsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      data-testid="stats-cards-skeleton"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}
