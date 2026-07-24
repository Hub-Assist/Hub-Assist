"use client";

import { useRef } from "react";
import { WorkspaceFilters, WorkspaceType } from "@/types/workspace";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface WorkspaceFiltersProps {
  filters: WorkspaceFilters;
  onFiltersChange: (filters: WorkspaceFilters) => void;
  /** Controlled search value (raw — not yet debounced) */
  searchInput: string;
  onSearchChange: (value: string) => void;
}

export function WorkspaceFiltersComponent({
  filters,
  onFiltersChange,
  searchInput,
  onSearchChange,
}: WorkspaceFiltersProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleClearSearch = () => {
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  const handleClearAll = () => {
    onFiltersChange({});
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      {/* Search row */}
      <div className="mb-4">
        <label htmlFor="workspace-search" className="block text-sm font-medium mb-2">
          Search Workspaces
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3 text-gray-400 pointer-events-none" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
          </span>
          <Input
            id="workspace-search"
            ref={searchInputRef}
            type="search"
            placeholder="Search by name or description…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9 w-full md:w-96"
            aria-label="Search workspaces"
            autoComplete="off"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <Select
            value={filters.type || ""}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                type: (e.target.value as WorkspaceType) || undefined,
              })
            }
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
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                availability:
                  e.target.value === "" ? undefined : e.target.value === "true",
              })
            }
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
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                maxPrice: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
          />
        </div>
        <Button variant="outline" onClick={handleClearAll}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
