"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CalendarRange } from "lucide-react";
import type { AttendanceRecord } from "@/lib/apiClient";
import { getISOWeekRangeLabel, calculateDuration, isAnomalyRecord } from "@/utils/dateUtils";
import { TimelineDayGroup } from "./TimelineDayGroup";

interface TimelineWeekGroupProps {
  records: AttendanceRecord[];
  showMember?: boolean;
  defaultExpanded?: boolean;
}

export function TimelineWeekGroup({
  records,
  showMember = false,
  defaultExpanded = true,
}: TimelineWeekGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Group records by day YYYY-MM-DD
  const dayMap = new Map<string, AttendanceRecord[]>();

  let totalMinutes = 0;
  let anomalyCount = 0;

  records.forEach((record) => {
    const dayKey = record.date || record.clockIn.slice(0, 10);
    const existing = dayMap.get(dayKey) || [];
    existing.push(record);
    dayMap.set(dayKey, existing);

    const { minutes } = calculateDuration(record.clockIn, record.clockOut);
    totalMinutes += minutes;

    if (isAnomalyRecord(record).isAnomaly) {
      anomalyCount += 1;
    }
  });

  // Sort days chronologically descending (latest day first within week)
  const sortedDayKeys = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));

  const sampleDate = records[0]?.date || records[0]?.clockIn || "";
  const weekLabel = getISOWeekRangeLabel(sampleDate);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const formattedWeekDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const toggleAccordion = () => setIsExpanded((prev) => !prev);

  return (
    <div
      role="region"
      aria-label={`Attendance section for ${weekLabel}`}
      className="overflow-hidden rounded-2xl border border-[#D7CFC6] bg-white shadow-xs"
    >
      {/* Accordion Header Button */}
      <button
        type="button"
        onClick={toggleAccordion}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between bg-[#F3EBE2] px-4 py-3.5 text-left transition-colors hover:bg-[#EDE2D6] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EDE2D6] text-[#1A1A1A]">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-[#6B6B6B]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-[#1A1A1A]">{weekLabel}</h3>
            </div>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              {records.length} {records.length === 1 ? "session" : "sessions"} • {formattedWeekDuration}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {anomalyCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-300"
              title={`${anomalyCount} anomaly records in this week`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-700" aria-hidden="true" />
              <span>{anomalyCount} {anomalyCount === 1 ? "anomaly" : "anomalies"}</span>
            </span>
          )}
        </div>
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="flex flex-col gap-4 p-4">
          {sortedDayKeys.map((dayKey) => (
            <TimelineDayGroup
              key={dayKey}
              date={dayKey}
              records={dayMap.get(dayKey) || []}
              showMember={showMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
