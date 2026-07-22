# Loading Skeleton Screens — Implementation Plan

## Goal

Replace ad-hoc inline spinner/skeleton blocks in every dashboard section with
reusable, layout-matched skeleton components. The result must:

- Prevent cumulative layout shift (CLS) — skeleton shapes match final content dimensions.
- Be accessible — `aria-hidden="true"` on skeletons; `aria-live="polite"` region
  announces "Content loaded" when real content replaces a skeleton.
- Use CSS-only shimmer animation (`animate-pulse` from Tailwind, no JS timers).
- Be fully tested (unit + snapshot).

---

## Current State

| Component | Loading UI | File |
|---|---|---|
| `StatsCards` | 4 × `h-28 animate-pulse rounded-2xl bg-[#EDE2D6]` | `components/dashboard/StatsCards.tsx` |
| `AnalyticsChart` | 1 × `h-48 animate-pulse rounded-2xl bg-[#EDE2D6]` | `components/dashboard/AnalyticsChart.tsx` |
| `ActivityFeed` | 4 × `h-12 animate-pulse rounded-xl bg-[#EDE2D6]` | `components/dashboard/ActivityFeed.tsx` |
| `BookingsPage` | 3 × `h-24 animate-pulse rounded-xl bg-[#EDE2D6]` | `app/dashboard/bookings/page.tsx` |

All are inline, not reusable, have no `aria-*` attributes, and no tests.

---

## Design Decisions

### 1. `Skeleton` primitive (`components/ui/Skeleton.tsx`)

A low-level building block that renders a single shimmer block. Props:

```ts
interface SkeletonProps {
  className?: string;   // override / extend sizing, rounding, etc.
}
```

Renders a `<div aria-hidden="true">` with `animate-pulse bg-[#EDE2D6] rounded-xl`
as defaults. Consumers override dimensions via `className`.

### 2. Layout-specific skeleton components (`components/dashboard/`)

Each mirrors its real component's outer HTML structure so dimensions are identical:

| Skeleton | Mirrors | Key dimensions |
|---|---|---|
| `StatsCardsSkeleton` | `StatsCards` grid | `grid grid-cols-2 lg:grid-cols-4 gap-4`, 4 × `h-28 rounded-2xl` |
| `AnalyticsChartSkeleton` | `AnalyticsChart` content area | tab bar placeholder + `h-48 rounded-2xl` chart area |
| `ActivityFeedSkeleton` | `ActivityFeed` list | 4 × `h-12 rounded-xl` rows with icon + text skeleton detail |
| `BookingListSkeleton` | `BookingCard` list | 3 × `rounded-2xl` cards matching `BookingCard` two-row layout |

### 3. Replacing inline skeletons

- `StatsCards.tsx`: remove inline `SkeletonCard`, import and render `<StatsCardsSkeleton />`.
- `AnalyticsChart.tsx`: replace `h-48 animate-pulse` block with `<AnalyticsChartSkeleton />`.
- `ActivityFeed.tsx`: replace inline rows with `<ActivityFeedSkeleton />`.
- `bookings/page.tsx`: replace inline rows with `<BookingListSkeleton />`.

### 4. `aria-live` region in `DashboardContent`

Add a visually-hidden `<div aria-live="polite" aria-atomic="true">` that renders
`""` while any skeleton is visible and `"Content loaded"` once data arrives.

Since `DashboardContent` does not own query state, the simplest correct approach
is to detect the overall loading state by checking whether the `StatsCards` data
(the first and most prominent section) has loaded. We do this by passing an
`onLoaded` callback or, simpler, by using a `useIsFetching` counter from
React Query — which returns 0 when all queries are settled.

```tsx
// DashboardContent.tsx
import { useIsFetching } from "@tanstack/react-query";
const isFetching = useIsFetching();
// ...
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {isFetching === 0 ? "Content loaded" : ""}
</div>
```

### 5. Tests (`__tests__/components/dashboard/`)

Two test files:

#### `StatsCards.test.tsx`
- Mocks `@tanstack/react-query` `useQuery`.
- `isPending: true` → skeleton is rendered (present in DOM, not the cards).
- `isPending: false, data: {...}` → cards rendered, skeleton absent.

#### `skeletons.test.tsx` (snapshot)
- Renders each skeleton component and checks against stored snapshots.
- Validates `aria-hidden="true"` attribute is present on the skeleton root.

---

## File Plan

```
frontend/
  src/
    components/
      ui/
        Skeleton.tsx                          ← NEW primitive
      dashboard/
        skeletons/
          StatsCardsSkeleton.tsx              ← NEW
          AnalyticsChartSkeleton.tsx          ← NEW
          ActivityFeedSkeleton.tsx            ← NEW
          BookingListSkeleton.tsx             ← NEW
          index.ts                            ← NEW barrel export
        StatsCards.tsx                        ← MODIFIED
        AnalyticsChart.tsx                    ← MODIFIED
        ActivityFeed.tsx                      ← MODIFIED
    app/
      dashboard/
        DashboardContent.tsx                  ← MODIFIED (aria-live)
        bookings/
          page.tsx                            ← MODIFIED
  __tests__/
    components/
      dashboard/
        StatsCards.test.tsx                   ← NEW
        skeletons.test.tsx                    ← NEW
```

---

## Implementation Order

1. Create branch `feat/frontend/loading-skeleton-screens`
2. `Skeleton.tsx` primitive
3. `StatsCardsSkeleton`, `AnalyticsChartSkeleton`, `ActivityFeedSkeleton`, `BookingListSkeleton` + barrel
4. Update `StatsCards.tsx`, `AnalyticsChart.tsx`, `ActivityFeed.tsx`, `bookings/page.tsx`
5. Update `DashboardContent.tsx` with `aria-live` region
6. Write tests
7. Run build + tests to verify

---

## Accessibility Notes

- Every skeleton root div carries `aria-hidden="true"` so screen readers skip it.
- The `aria-live="polite"` region is in `DashboardContent`; it reads "Content loaded"
  once all active queries settle (`useIsFetching() === 0`).
- The live region is `sr-only` (Tailwind utility) so it is invisible but announced.

---

## No-CLS Guarantee

Because each skeleton component uses the exact same grid/flex container and the
exact same height classes as the real content, the page height does not change
when skeletons are swapped for data. The only dimension that can differ is the
`ActivityFeed` item count (real count vs. 4 skeleton rows) and `BookingList`
(real count vs. 3 skeleton rows) — acceptable because the skeleton count matches
the API's typical page size.
