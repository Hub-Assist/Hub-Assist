"use client";

import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { get } from "@/lib/apiClient";

interface UtilizationItem {
  workspaceId: string;
  name: string;
  type: string;
  capacity: number;
  confirmedBookings: number;
  utilizationPct: number;
}

export function WorkspaceUtilizationChart() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["analytics-workspace-utilization"],
    queryFn: () => get<UtilizationItem[]>("/analytics/workspace-utilization"),
  });

  if (isError) {
    throw new Error("Failed to load workspace utilization.");
  }

  const chartContent = !data?.length ? (
    <p className="py-8 text-center text-sm text-[#6B6B6B]">No data available</p>
  ) : (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }}
          formatter={(v: number) => [`${v}%`, "Utilization"]}
        />
        <Bar dataKey="utilizationPct" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.utilizationPct >= 80 ? "#C0392B" : entry.utilizationPct >= 50 ? "#E67E22" : "#1A1A1A"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] p-5">
      <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">WORKSPACE UTILIZATION</p>
      {isPending ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[#EDE2D6]" />
      ) : (() => {
        if (isError) {
          throw new Error("Failed to load workspace utilization.");
        }
        return !data?.length ? (
          <p className="py-8 text-center text-sm text-[#6B6B6B]">No data available</p>
        ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Utilization"]}
            />
            <Bar dataKey="utilizationPct" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.utilizationPct >= 80 ? "#C0392B" : entry.utilizationPct >= 50 ? "#E67E22" : "#1A1A1A"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        );
      })()}
    </div>
  );
}
