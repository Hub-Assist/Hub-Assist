"use client";

import React from "react";
import { Calendar, RefreshCw } from "lucide-react";

export type PresetRange = "7d" | "30d" | "90d" | "all" | "custom";

interface DateRangeFilterProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  activePreset: PresetRange;
  onPresetSelect: (preset: PresetRange) => void;
  onReset: () => void;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  activePreset,
  onPresetSelect,
  onReset,
}: DateRangeFilterProps) {
  const presets: { id: PresetRange; label: string }[] = [
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
    { id: "90d", label: "Last 90 Days" },
    { id: "all", label: "All Time" },
  ];

  return (
    <div
      role="search"
      aria-label="Filter attendance by date range"
      className="flex flex-col gap-4 rounded-2xl border border-[#D7CFC6] bg-[#F3EBE2] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
          <Calendar className="h-4 w-4 text-[#6B6B6B]" aria-hidden="true" />
          <span>Date Range Filter</span>
        </div>

        {/* Presets */}
        <div
          role="group"
          aria-label="Date range presets"
          className="flex flex-wrap items-center gap-1.5"
        >
          {presets.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetSelect(preset.id)}
                aria-pressed={isActive}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] ${
                  isActive
                    ? "bg-[#1A1A1A] text-white shadow-sm"
                    : "bg-[#EDE2D6] text-[#1A1A1A] hover:bg-[#E3D6C8]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset date filters to last 30 days"
            className="flex items-center gap-1 rounded-xl bg-[#EDE2D6] px-2.5 py-1.5 text-xs font-medium text-[#6B6B6B] hover:bg-[#E3D6C8] hover:text-[#1A1A1A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="start-date-input" className="text-xs font-medium text-[#6B6B6B]">
            Start Date
          </label>
          <input
            id="start-date-input"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full rounded-xl border border-[#D7CFC6] bg-white px-3 py-2 text-sm text-[#1A1A1A] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
            aria-label="Start date"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="end-date-input" className="text-xs font-medium text-[#6B6B6B]">
            End Date
          </label>
          <input
            id="end-date-input"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full rounded-xl border border-[#D7CFC6] bg-white px-3 py-2 text-sm text-[#1A1A1A] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
            aria-label="End date"
          />
        </div>
      </div>
    </div>
  );
}
