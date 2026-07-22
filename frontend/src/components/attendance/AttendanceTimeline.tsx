"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Download, Layers } from "lucide-react";
import type { AttendanceRecord } from "@/lib/apiClient";
import { getISOWeekKey, isAnomalyRecord, calculateDuration } from "@/utils/dateUtils";
import { exportToCSV } from "@/utils/exportToCSV";
import { DateRangeFilter, type PresetRange } from "./DateRangeFilter";
import { TimelineWeekGroup } from "./TimelineWeekGroup";
import { EmptyAttendanceState } from "./EmptyAttendanceState";

interface AttendanceTimelineProps {
  records: AttendanceRecord[];
  showMember?: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  activePreset: PresetRange;
  onPresetSelect: (preset: PresetRange) => void;
  onResetFilters: () => void;
}

export function AttendanceTimeline({
  records,
  showMember = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  activePreset,
  onPresetSelect,
  onResetFilters,
}: AttendanceTimelineProps) {
  const [visibleItemsLimit, setVisibleItemsLimit] = useState(10); // Window limit for virtualization when records > 100

  // Filter records by date range (inclusive) without mutating source data
  const filteredRecords = useMemo(() => {
    if (!records) return [];

    return records.filter((record) => {
      const recordDate = record.date || record.clockIn.slice(0, 10);
      if (startDate && recordDate < startDate) return false;
      if (endDate && recordDate > endDate) return false;
      return true;
    });
  }, [records, startDate, endDate]);

  // Group filtered records by ISO week (non-mutating memoized operation)
  const groupedByWeek = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();

    filteredRecords.forEach((record) => {
      const weekKey = getISOWeekKey(record.clockIn || record.date);
      const existing = map.get(weekKey) || [];
      existing.push(record);
      map.set(weekKey, existing);
    });

    // Sort weeks descending (latest ISO week first)
    const sortedWeekKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return sortedWeekKeys.map((weekKey) => ({
      weekKey,
      records: map.get(weekKey) || [],
    }));
  }, [filteredRecords]);

  // Summary statistics for action bar
  const stats = useMemo(() => {
    let totalMins = 0;
    let anomalyCount = 0;

    filteredRecords.forEach((r) => {
      const { minutes } = calculateDuration(r.clockIn, r.clockOut);
      totalMins += minutes;
      if (isAnomalyRecord(r).isAnomaly) {
        anomalyCount += 1;
      }
    });

    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const totalTimeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      totalSessions: filteredRecords.length,
      totalTimeFormatted,
      anomalyCount,
    };
  }, [filteredRecords]);

  // Handle Export CSV
  const handleExport = useCallback(() => {
    exportToCSV(filteredRecords, `attendance_report_${startDate}_to_${endDate}.csv`);
  }, [filteredRecords, startDate, endDate]);

  const isLargeDataset = filteredRecords.length > 100;
  const displayedWeekGroups = isLargeDataset
    ? groupedByWeek.slice(0, visibleItemsLimit)
    : groupedByWeek;

  const handleLoadMore = () => {
    setVisibleItemsLimit((prev) => prev + 10);
  };

  return (
    <div className="flex flex-col gap-6" role="region" aria-label="Attendance History Timeline">
      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        activePreset={activePreset}
        onPresetSelect={onPresetSelect}
        onReset={onResetFilters}
      />

      {/* Header & CSV Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#D7CFC6] bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#6B6B6B]">
          <div>
            <span className="font-bold text-[#1A1A1A]">{stats.totalSessions}</span> Sessions
          </div>
          <span>•</span>
          <div>
            Total Duration: <span className="font-bold text-[#1A1A1A]">{stats.totalTimeFormatted}</span>
          </div>
          {stats.anomalyCount > 0 && (
            <>
              <span>•</span>
              <div className="font-bold text-amber-700">
                {stats.anomalyCount} {stats.anomalyCount === 1 ? "Anomaly" : "Anomalies"}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={filteredRecords.length === 0}
          aria-label="Export visible attendance records to RFC 4180 CSV"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Timeline Content */}
      {filteredRecords.length === 0 ? (
        <EmptyAttendanceState
          hasFilters={true}
          onResetFilters={onResetFilters}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {displayedWeekGroups.map(({ weekKey, records: weekRecords }, index) => (
            <TimelineWeekGroup
              key={weekKey}
              records={weekRecords}
              showMember={showMember}
              defaultExpanded={index === 0} // Expand latest week by default
            />
          ))}

          {/* Virtualization load more control for datasets > 100 */}
          {isLargeDataset && visibleItemsLimit < groupedByWeek.length && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="flex items-center gap-2 rounded-xl border border-[#D7CFC6] bg-[#F3EBE2] px-5 py-2.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#EDE2D6] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
              >
                <Layers className="h-4 w-4 text-[#6B6B6B]" aria-hidden="true" />
                <span>Load More Weeks ({groupedByWeek.length - visibleItemsLimit} remaining)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
