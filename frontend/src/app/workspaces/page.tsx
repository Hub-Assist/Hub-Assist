"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Workspace, WorkspaceFilters, WorkspaceType } from "@/types/workspace";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";
import { WorkspaceFiltersComponent } from "@/components/workspaces/WorkspaceFilters";
import { useFiltersWithUrl, type FilterSchema } from "@/hooks/useFiltersWithUrl";
import { booleanCodec, enumCodec, numberCodec } from "@/lib/filters/codecs";

const WORKSPACE_TYPES: WorkspaceType[] = ["office", "meeting-room", "desk", "conference-room"];

const DEFAULT_WORKSPACE_FILTERS: WorkspaceFilters = {};

const WORKSPACE_FILTERS_SCHEMA: FilterSchema<WorkspaceFilters> = {
  type: enumCodec(WORKSPACE_TYPES),
  availability: booleanCodec(),
  minPrice: numberCodec(),
  maxPrice: numberCodec(),
};

interface WorkspacesResponse {
  workspaces: Workspace[];
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const getTypeBadgeColor = (type: WorkspaceType) => {
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
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
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
          <h3 className="text-lg font-semibold">{workspace.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(workspace.type)}`}>
            {workspace.type.replace("-", " ")}
          </span>
        </div>
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
  );
}

function WorkspacesContent() {
  const [filters, setFilters] = useFiltersWithUrl(DEFAULT_WORKSPACE_FILTERS, WORKSPACE_FILTERS_SCHEMA);

  const { data, isLoading, isError } = useQuery<WorkspacesResponse>({
    queryKey: ["workspaces", filters],
    queryFn: () => api.getWorkspaces(filters),
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md h-80 animate-pulse" />
          ))}
        </div>
      </div>
    );
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

      <WorkspaceFiltersComponent filters={filters} onFiltersChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.workspaces?.length ? (
          data.workspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500">No workspaces found matching your criteria.</p>
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
