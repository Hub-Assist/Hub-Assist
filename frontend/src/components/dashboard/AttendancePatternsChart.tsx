"use client";

import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { get } from "@/lib/apiClient";

interface AttendancePatterns {
  peakHours: Array<{ hour: number; count: number }>;
  dayOfWeekPatterns: Array<{ day: string; count: number }>;
}

export function AttendancePatternsChart() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["analytics-attendance-patterns"],
    queryFn: () => get<AttendancePatterns>("/analytics/attendance-patterns"),
  });

  if (isPending) return <div className="h-48 animate-pulse rounded-2xl bg-[#EDE2D6]" />;
  if (isError) {
    throw new Error("Failed to load attendance patterns.");
  }
  if (!data) return null;

  const hourData = data.peakHours
    .map((h) => ({ label: `${h.hour}:00`, count: h.count }))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label));

  const dayData = data.dayOfWeekPatterns;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] p-5">
        <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">PEAK HOURS</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={hourData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="count" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] p-5">
        <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">DAY OF WEEK</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={dayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="count" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
