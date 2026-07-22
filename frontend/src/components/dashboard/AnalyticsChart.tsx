"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { get } from "@/lib/apiClient";
import { AnalyticsChartSkeleton } from "@/components/dashboard/skeletons";
import { useDashboardPolling } from "@/hooks/useDashboardPolling";

type Period = "7d" | "30d" | "90d";

export function AnalyticsChart() {
  const [period, setPeriod] = useState<Period>("30d");
  const pollingState = useDashboardPolling();

  const { data, isPending, isError } = useQuery({
    queryKey: ["analytics-member-growth", period],
    queryFn: () =>
      get<Array<{ date: string; count: number }>>(`/analytics/member-growth?period=${period}`).catch(() =>
        get<Array<{ date: string; members: number }>>("/dashboard/growth").then((rows) =>
          rows.map((r) => ({ date: r.date, count: r.members })),
        ),
      ),
    refetchInterval: pollingState.refetchInterval,
    refetchIntervalInBackground: false,
  });

  // Handle query state changes for adaptive polling
  if (isError) {
    pollingState.onError();
  } else if (data) {
    pollingState.onSuccess();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">MEMBER GROWTH</p>
        <div className="flex gap-1 rounded-lg bg-[#EDE2D6] p-1 text-xs">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2 py-0.5 transition-colors ${period === p ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {isPending ? (
        <AnalyticsChartSkeleton />
      ) : (() => {
        if (isError) {
          throw new Error("Failed to load analytics chart.");
        }
        return !data?.length ? (
          <p className="py-8 text-center text-sm text-[#6B6B6B]">No data available</p>
        ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }}
              cursor={{ fill: "#EDE2D6" }}
            />
            <Bar dataKey="count" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        );
      })()}
    </div>
  );
}
