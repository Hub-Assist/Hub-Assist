"use client";

import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";

export function AnalyticsChart() {
  const token = useAuthStore((s) => s.token) ?? "";
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard-growth"],
    queryFn: () => api.getDashboardGrowth(token),
    enabled: !!token,
  });

  if (isPending) return <div className="h-48 animate-pulse rounded-2xl bg-[#EDE2D6]" />;
  if (isError || !data?.length) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D7CFC6" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#6B6B6B" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#F3EBE2", border: "1px solid #D7CFC6", borderRadius: 12, fontSize: 12 }}
          cursor={{ fill: "#EDE2D6" }}
        />
        <Bar dataKey="members" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
