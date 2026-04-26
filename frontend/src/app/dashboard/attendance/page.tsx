"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { ClockButton } from "@/components/attendance/ClockButton";
import { AttendanceLog } from "@/components/attendance/AttendanceLog";
import { AttendanceSummary } from "@/components/attendance/AttendanceSummary";

export default function AttendancePage() {
  const token = useAuthStore((s) => s.token) ?? "";
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", date],
    queryFn: () => api.getAttendance(token, date),
    enabled: !!token,
  });

  // The active (open) session for the current user — no clockOut yet
  const activeRecord = isAdmin
    ? undefined
    : records.find((r) => !r.clockOut);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-[#1A1A1A]">Attendance</h1>

      {!isAdmin && (
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-[#F3EBE2] border border-[#D7CFC6] py-10">
          <p className="text-sm font-medium text-[#6B6B6B]">
            {activeRecord ? "You are clocked in" : "You are clocked out"}
          </p>
          <ClockButton activeRecord={activeRecord} />
        </div>
      )}

      {/* Date filter (admin) or today label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B] uppercase">
          {isAdmin ? "All Attendance" : "Today's Log"}
        </p>
        {isAdmin && (
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-[#D7CFC6] bg-[#F3EBE2] px-3 py-1.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
          />
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[#6B6B6B]">Loading…</p>
      ) : (
        <>
          {!isAdmin && <AttendanceSummary records={records} />}
          <AttendanceLog records={records} showMember={isAdmin} />
        </>
      )}
    </div>
  );
}
