"use client";

import { Suspense } from "react";
import type { WorkspaceFilters, WorkspaceType } from "@/types/workspace";
import { Button } from "@/components/ui/Button";
import { WorkspaceFiltersComponent } from "@/components/workspaces/WorkspaceFilters";
import { HighlightText } from "@/components/workspaces/HighlightText";
import { useFiltersWithUrl, type FilterSchema } from "@/hooks/useFiltersWithUrl";
import { useDebounce } from "@/hooks/useDebounce";
import { useWorkspaces } from "@/lib/react-query/hooks/workspaces/useWorkspaces";
import { booleanCodec, enumCodec, numberCodec, stringCodec } from "@/lib/filters/codecs";

const WORKSPACE_TYPES: WorkspaceType[] = ["office", "meeting-room", "desk", "conference-room"];

const DEFAULT_WORKSPACE_FILTERS: WorkspaceFilters = {};

const WORKSPACE_FILTERS_SCHEMA: FilterSchema<WorkspaceFilters> = {
  type: enumCodec(WORKSPACE_TYPES),
  availability: booleanCodec(),
  minPrice: numberCodec(),
  maxPrice: numberCodec(),
  search: stringCodec(),
};

function getTypeBadgeColor(type: WorkspaceType) {
  switch (type) {
    case "office":
      return "bg-blue-100 text-blue-800";
    case "meeting-room":
      return "bg-green-100 text-green-800";
    case "desk":
      return "bg-yellow-100 text-yellow-800";
    case "conference-room":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function WorkspaceSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md h-80 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function WorkspacesContent() {
  // URL-synced filters (includes search for shareability)
  const [filters, setFilters] = useFiltersWithUrl(DEFAULT_WORKSPACE_FILTERS, WORKSPACE_FILTERS_SCHEMA);

  // The search input is stored in filters.search so it survives page reload and is shareable.
  // We keep raw input in a separate state so we can show the un-debounced text in the input.
  // However, since useFiltersWithUrl already syncs to URL, we use filters.search as the
  // source of truth for the controlled input and debounce it before sending to the query.
  const rawSearch = filters.search ?? "";

  // Debounce the raw search value — 300 ms delay, 2-char minimum enforced in useWorkspaces
  const debouncedSearch = useDebounce(rawSearch, 300);

  // Merge debounced search with other filters for the query
  const { data, isLoading, isError, isFetching } = useWorkspaces({
    type: filters.type,
    availability: filters.availability,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    search: debouncedSearch,
  });

  const workspaces = data?.workspaces ?? [];
  const count = workspaces.length;

  // Handler: update search in URL state
  const handleSearchChange = (value: string) => {
    setFilters({ ...filters, search: value || undefined });
  };

  // Handler: clear non-search filters
  const handleFiltersChange = (next: WorkspaceFilters) => {
    setFilters({ ...next, search: filters.search });
  };

  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  if (isError) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center py-12">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg inline-block">
          Failed to load workspaces. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workspaces</h1>
        <p className="text-gray-600">Find and book the perfect workspace for your needs</p>
      </div>

      <WorkspaceFiltersComponent
        filters={{ type: filters.type, availability: filters.availability, minPrice: filters.minPrice, maxPrice: filters.maxPrice }}
        onFiltersChange={handleFiltersChange}
        searchInput={rawSearch}
        onSearchChange={handleSearchChange}
      />

      {/* Result count — shown whenever a search or filter is active */}
      {(debouncedSearch || filters.type || filters.availability !== undefined || filters.maxPrice) && (
        <p
          className="text-sm text-gray-500 mb-4"
          aria-live="polite"
          aria-atomic="true"
        >
          {isFetching ? (
            "Searching…"
          ) : (
            <>
              <span className="font-medium text-gray-700">{count}</span>{" "}
              {count === 1 ? "workspace" : "workspaces"} found
              {debouncedSearch && debouncedSearch.trim().length >= 2 && (
                <>
                  {" "}for <span className="font-medium text-gray-700">&ldquo;{debouncedSearch}&rdquo;</span>
                </>
              )}
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.length > 0 ? (
          workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="h-48 bg-gray-200 flex items-center justify-center">
                {workspace.images?.[0] ? (
                  <img
                    src={workspace.images[0]}
                    alt={workspace.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500">No Image</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    <HighlightText text={workspace.name} query={debouncedSearch} />
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(workspace.type)}`}
                  >
                    {workspace.type.replace("-", " ")}
                  </span>
                </div>
                {workspace.description && (
                  <p className="text-gray-600 text-sm mb-2">
                    <HighlightText text={workspace.description} query={debouncedSearch} />
                  </p>
                )}
                <p className="text-gray-600 text-sm mb-2">
                  Capacity: {workspace.capacity} • ${workspace.pricePerHour}/hour
                </p>
                <p className="text-gray-600 text-sm mb-4">
                  {workspace.availability ? (
                    <span className="text-green-600">Available</span>
                  ) : (
                    <span className="text-red-600">Unavailable</span>
                  )}
                </p>
                <Button className="w-full" disabled={!workspace.availability}>
                  {workspace.availability ? "Book Now" : "Unavailable"}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            {debouncedSearch && debouncedSearch.trim().length >= 2 ? (
              <div>
                <p className="text-gray-500 text-lg mb-2">
                  No workspaces found for &ldquo;<span className="font-medium">{debouncedSearch}</span>&rdquo;.
                </p>
                <p className="text-gray-400 text-sm">
                  Try a different search term or{" "}
                  <button
                    type="button"
                    className="text-blue-600 underline hover:text-blue-800"
                    onClick={() => handleSearchChange("")}
                  >
                    clear the search
                  </button>
                  .
                </p>
              </div>
            ) : (
              <p className="text-gray-500">No workspaces found matching your criteria.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  return (
    <Suspense>
      <WorkspacesContent />
    </Suspense>
  );
}
