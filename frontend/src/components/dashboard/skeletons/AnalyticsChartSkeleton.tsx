import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the AnalyticsChart layout:
 *   - header row: label text + period-toggle pill (h-7)
 *   - chart area: h-48 rounded-2xl
 *
 * The parent card (`rounded-2xl bg-[#F3EBE2] p-5`) is rendered in
 * DashboardContent, so this skeleton only covers the inner content.
 */
export function AnalyticsChartSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3"
      data-testid="analytics-chart-skeleton"
    >
      {/* Header row: label + period toggle */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      {/* Chart area */}
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}
