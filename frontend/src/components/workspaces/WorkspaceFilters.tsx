"use client";

import { WorkspaceFilters, WorkspaceType } from "@/types/workspace";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface WorkspaceFiltersProps {
  filters: WorkspaceFilters;
  onFiltersChange: (filters: WorkspaceFilters) => void;
}

export function WorkspaceFiltersComponent({ filters, onFiltersChange }: WorkspaceFiltersProps) {
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