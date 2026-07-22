"use client";

import React from "react";
import { AlertTriangle, Clock, User } from "lucide-react";
import type { AttendanceRecord } from "@/lib/apiClient";
import { calculateDuration, isAnomalyRecord, formatTimeLabel } from "@/utils/dateUtils";

interface TimelineSessionBarProps {
  record: AttendanceRecord;
  showMember?: boolean;
}

export function TimelineSessionBar({ record, showMember = false }: TimelineSessionBarProps) {
  const { isAnomaly, reason } = isAnomalyRecord(record);
  const { minutes, formatted, isCompleted } = calculateDuration(record.clockIn, record.clockOut);

  // Proportional bar width: map 0 to 1440 minutes (24h) or max 12h (720m) scale, minimum 6% width for visibility
  const maxScaleMins = 720; // 12 hours as full width benchmark
  const widthPercentage = !isCompleted && minutes === 0
    ? 15
    : Math.min(100, Math.max(6, (minutes / maxScaleMins) * 100));

  const clockInFormatted = formatTimeLabel(record.clockIn);
  const clockOutFormatted = isCompleted ? formatTimeLabel(record.clockOut) : "Active";

  const memberDisplayName = record.memberName || "Member";
  const ariaDescription = `Attendance session for ${memberDisplayName}: Clock in ${clockInFormatted}, Clock out ${clockOutFormatted}, Duration ${formatted}${
    isAnomaly ? `, Anomaly status: ${reason}` : ""
  }`;

  return (
    <div
      role="article"
      aria-label={ariaDescription}
      className={`group relative flex flex-col gap-2 rounded-xl border p-3 sm:p-4 transition-all ${
        isAnomaly
          ? "border-amber-400 bg-amber-50/80 shadow-xs"
          : "border-[#D7CFC6] bg-white shadow-2xs hover:border-[#1A1A1A]/30"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        {/* Left side: Member & Time info */}
        <div className="flex items-center gap-3">
          {showMember && (
            <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A]">
              <User className="h-3.5 w-3.5 text-[#6B6B6B]" aria-hidden="true" />
              <span>{memberDisplayName}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[#6B6B6B]">
            <Clock className="h-3.5 w-3.5 text-[#6B6B6B]" aria-hidden="true" />
            <span className="font-medium text-[#1A1A1A]">{clockInFormatted}</span>
            <span>→</span>
            <span className="font-medium text-[#1A1A1A]">{clockOutFormatted}</span>
          </div>
        </div>

        {/* Right side: Duration pill & Anomaly Badge */}
        <div className="flex items-center gap-2">
          {isAnomaly && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300"
              title={reason}
            >
              <AlertTriangle className="h-3 w-3 text-amber-700" aria-hidden="true" />
              <span>{record.autoCompleted ? "Auto-completed" : "Anomaly"}</span>
            </span>
          )}

          <span
            className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${
              !isCompleted
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse"
                : isAnomaly
                ? "bg-amber-200 text-amber-900"
                : "bg-[#F3EBE2] text-[#1A1A1A]"
            }`}
          >
            {formatted}
          </span>
        </div>
      </div>

      {/* Visual Proportional Duration Bar */}
      <div
        aria-hidden="true"
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#EDE2D6]"
      >
        <div
          style={{ width: `${widthPercentage}%` }}
          className={`h-full rounded-full transition-all duration-300 ${
            isAnomaly
              ? "bg-amber-500"
              : !isCompleted
              ? "bg-emerald-500"
              : "bg-[#1A1A1A]"
          }`}
        />
      </div>

      {/* Anomaly Reason details if present */}
      {isAnomaly && reason && (
        <div className="flex items-center gap-1 text-xs text-amber-800 font-medium">
          <span className="font-bold">[Anomaly Info]:</span>
          <span>{reason}</span>
        </div>
      )}
    </div>
  );
}
