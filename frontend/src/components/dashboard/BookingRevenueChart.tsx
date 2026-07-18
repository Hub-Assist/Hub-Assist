"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { get } from "@/lib/apiClient";

type Period = "7d" | "30d" | "90d";

export function BookingRevenueChart() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data, isPending, isError } = useQuery({
    queryKey: ["analytics-booking-revenue", period],
    queryFn: () => get<Array<{ date: string; revenue: number }>>(`/analytics/booking-revenue?period=${period}`),
  });

  if (isError) {
    throw new Error("Failed to load booking revenue.");
  }

  const chartContent = !data?.length ? (
    <p className="py-8 text-center text-sm text-[#6B6B6B]">No data available</p>
  ) : (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1A1A1A" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#1A1A1A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
        />
        <Area dataKey="revenue" stroke="#1A1A1A" strokeWidth={2} fill="url(#revenueGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">BOOKING REVENUE</p>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      {isPending ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[#EDE2D6]" />
      ) : (
        chartContent
      )}
    </div>
  );
}

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-[#EDE2D6] p-1 text-xs">
      {(["7d", "30d", "90d"] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-2 py-0.5 transition-colors ${value === p ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]"}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
