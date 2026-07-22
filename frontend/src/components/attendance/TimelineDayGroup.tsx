"use client";

import React from "react";
import type { AttendanceRecord } from "@/lib/apiClient";
import { formatDateLabel, calculateDuration } from "@/utils/dateUtils";
import { TimelineSessionBar } from "./TimelineSessionBar";

interface TimelineDayGroupProps {
  date: string; // YYYY-MM-DD
  records: AttendanceRecord[];
  showMember?: boolean;
}

export function TimelineDayGroup({ date, records, showMember = false }: TimelineDayGroupProps) {
  // Ensure records are sorted chronologically by clockIn ascending
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime()
  );

  const totalMinutes = sortedRecords.reduce((acc, r) => {
    const { minutes } = calculateDuration(r.clockIn, r.clockOut);
    return acc + minutes;
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const totalFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const dateHeading = formatDateLabel(date);

  return (
    <div
      role="region"
      aria-label={`Attendance records for ${dateHeading}`}
      className="flex flex-col gap-3 rounded-xl bg-[#F3EBE2]/60 border border-[#D7CFC6] p-3 sm:p-4"
    >
      <div className="flex items-center justify-between border-b border-[#D7CFC6]/80 pb-2">
        <h4 className="text-xs sm:text-sm font-bold text-[#1A1A1A] tracking-wide">
          {dateHeading}
        </h4>
        <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
          <span>
            {sortedRecords.length} {sortedRecords.length === 1 ? "session" : "sessions"}
          </span>
          <span>•</span>
          <span className="font-semibold text-[#1A1A1A]">{totalFormatted}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {sortedRecords.map((record) => (
          <TimelineSessionBar
            key={record.id}
            record={record}
            showMember={showMember}
          />
        ))}
      </div>
    </div>
  );
}
