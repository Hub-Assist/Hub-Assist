"use client";

import React from "react";
import { Clock, FilterX } from "lucide-react";

interface EmptyAttendanceStateProps {
  hasFilters?: boolean;
  onResetFilters?: () => void;
  message?: string;
}

export function EmptyAttendanceState({
  hasFilters = false,
  onResetFilters,
  message = "No attendance records found.",
}: EmptyAttendanceStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CFC6] bg-[#F3EBE2]/50 py-12 px-4 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDE2D6] text-[#6B6B6B] mb-3">
        {hasFilters ? (
          <FilterX className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Clock className="h-6 w-6" aria-hidden="true" />
        )}
      </div>

      <h3 className="text-base font-semibold text-[#1A1A1A]">{message}</h3>
      <p className="mt-1 text-sm text-[#6B6B6B] max-w-md">
        {hasFilters
          ? "There are no attendance records within the selected date range. Try expanding your filters."
          : "Clock in to start recording your workspace attendance."}
      </p>

      {hasFilters && onResetFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#333333] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
