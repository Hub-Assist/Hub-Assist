"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";
import type { AvailabilitySlot } from "@/types/workspace";

/**
 * Fetches the 24-slot hourly availability array for a workspace on a given date.
 *
 * Query key: ["workspaces", workspaceId, "availability", date]
 *
 * @param workspaceId - UUID of the workspace
 * @param date        - Date string in YYYY-MM-DD format (UTC)
 */
export function useWorkspaceAvailability(workspaceId: string, date: string) {
  return useQuery<AvailabilitySlot[]>({
    queryKey: queryKeys.workspaces.availability(workspaceId, date),
    queryFn: () => api.getWorkspaceAvailability(workspaceId, date),
    enabled: Boolean(workspaceId) && Boolean(date),
    // Availability changes with new bookings — keep data fresh but avoid
    // excessive refetches while the user is browsing the week.
    staleTime: 60_000, // 1 minute
  });
}
