"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter } from "lucide-react";
import { Workspace, WorkspaceType, WorkspaceFilters } from "@/types/workspace";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

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

function WorkspaceFilters({ filters, onFiltersChange }: {
  filters: WorkspaceFilters;
  onFiltersChange: (filters: WorkspaceFilters) => void;
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <Select
            value={filters.type || ""}
            onChange={(e) => onFiltersChange({ ...filters, type: e.target.value as WorkspaceType || undefined })}
          >
            <option value="">All Types</option>
            <option value="office">Office</option>
            <option value="meeting-room">Meeting Room</option>
            <option value="desk">Desk</option>
            <option value="conference-room">Conference Room</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Availability</label>
          <Select
            value={filters.availability === undefined ? "" : filters.availability.toString()}
            onChange={(e) => onFiltersChange({
              ...filters,
              availability: e.target.value === "" ? undefined : e.target.value === "true"
            })}
          >
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Max Price ($/hour)</label>
          <Input
            type="number"
            placeholder="Max price"
            value={filters.maxPrice || ""}
            onChange={(e) => onFiltersChange({
              ...filters,
              maxPrice: e.target.value ? parseInt(e.target.value) : undefined
            })}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => onFiltersChange({})}
        >
          Clear Filters
        </Button>
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  const [filters, setFilters] = useState<WorkspaceFilters>({});

  const { data, isLoading } = useQuery<WorkspacesResponse>({
    queryKey: ["workspaces", filters],
    queryFn: () => api.getWorkspaces(filters),
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading workspaces...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workspaces</h1>
        <p className="text-gray-600">Find and book the perfect workspace for your needs</p>
      </div>

      <WorkspaceFilters filters={filters} onFiltersChange={setFilters} />

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