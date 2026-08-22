"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";
import type { Workspace, WorkspaceFilters } from "@/types/workspace";

export interface UseWorkspacesOptions extends WorkspaceFilters {
  /**
   * Search term (minimum 2 characters to trigger an API call).
   * Shorter strings are ignored and treated as no search.
   */
  search?: string;
}

export interface WorkspacesResponse {
  workspaces: Workspace[];
}

/**
 * Fetches the workspace list with optional filters and full-text search.
 *
 * The `search` parameter is included in the query key so React Query
 * automatically re-fetches (and caches separately) whenever the debounced
 * search value changes.  A query is only issued when the search term is
 * empty OR has at least 2 characters; single-character inputs keep the
 * previous data visible without making a network request.
 */
export function useWorkspaces(options: UseWorkspacesOptions = {}) {
  const { search, ...filters } = options;

  // Normalise: treat 0- or 1-char searches the same as no search
  const effectiveSearch = search && search.trim().length >= 2 ? search.trim() : undefined;

  const queryKey = queryKeys.workspaces.list({ ...filters, search: effectiveSearch });

  return useQuery<WorkspacesResponse>({
    queryKey,
    queryFn: () =>
      api.getWorkspaces({
        ...filters,
        ...(effectiveSearch ? { search: effectiveSearch } : {}),
      }),
    // Keep previous results visible while a new query is in flight so the
    // list doesn't flash to empty on every keystroke.
    placeholderData: (prev) => prev,
  });
}
