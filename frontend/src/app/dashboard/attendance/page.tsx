"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { ClockButton } from "@/components/attendance/ClockButton";
import { AttendanceSummary } from "@/components/attendance/AttendanceSummary";
import { AttendanceTimeline } from "@/components/attendance/AttendanceTimeline";
import type { PresetRange } from "@/components/attendance/DateRangeFilter";

function getInitialDates(): { today: string; thirtyDaysAgo: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const past = new Date(now.getTime() - 30 * 86400000);
  const thirtyDaysAgo = past.toISOString().slice(0, 10);
  return { today, thirtyDaysAgo };
}

export default function AttendancePage() {
  const token = useAuthStore((s) => s.token) ?? "";
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const { today, thirtyDaysAgo } = getInitialDates();
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [activePreset, setActivePreset] = useState<PresetRange>("30d");

  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ["attendance", startDate, endDate],
    queryFn: () => api.getAttendance(undefined, startDate, endDate),
    enabled: !!token,
  });

  // The active (open) session for the current user — no clockOut yet
  const activeRecord = isAdmin
    ? undefined
    : records.find((r) => !r.clockOut);

  const handlePresetSelect = useCallback(
    (preset: PresetRange) => {
      setActivePreset(preset);
      const now = new Date();
      const currentToday = now.toISOString().slice(0, 10);

      if (preset === "7d") {
        const past = new Date(now.getTime() - 7 * 86400000);
        setStartDate(past.toISOString().slice(0, 10));
        setEndDate(currentToday);
      } else if (preset === "30d") {
        const past = new Date(now.getTime() - 30 * 86400000);
        setStartDate(past.toISOString().slice(0, 10));
        setEndDate(currentToday);
      } else if (preset === "90d") {
        const past = new Date(now.getTime() - 90 * 86400000);
        setStartDate(past.toISOString().slice(0, 10));
        setEndDate(currentToday);
      } else if (preset === "all") {
        setStartDate("");
        setEndDate("");
      }
    },
    []
  );

  const handleStartDateChange = useCallback((date: string) => {
    setStartDate(date);
    setActivePreset("custom");
  }, []);

  const handleEndDateChange = useCallback((date: string) => {
    setEndDate(date);
    setActivePreset("custom");
  }, []);

  const handleResetFilters = useCallback(() => {
    const { today: t, thirtyDaysAgo: t30 } = getInitialDates();
    setStartDate(t30);
    setEndDate(t);
    setActivePreset("30d");
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Attendance Timeline</h1>
      </div>

      {!isAdmin && (
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-[#F3EBE2] border border-[#D7CFC6] py-10">
          <p className="text-sm font-medium text-[#6B6B6B]">
            {activeRecord ? "You are clocked in" : "You are clocked out"}
          </p>
          <ClockButton activeRecord={activeRecord} />
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[#EDE2D6] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100" role="alert">
          Failed to load attendance records. Please try again.
        </div>
      ) : (
        <>
          {!isAdmin && <AttendanceSummary records={records} />}
          <AttendanceTimeline
            records={records}
            showMember={isAdmin}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            activePreset={activePreset}
            onPresetSelect={handlePresetSelect}
            onResetFilters={handleResetFilters}
          />
        </>
      )}
    </div>
  );
}
