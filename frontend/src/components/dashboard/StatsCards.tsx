"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/apiClient";

function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl bg-[#EDE2D6]" />;
}

interface CardProps { label: string; value: string | number; sub?: string }
function StatCard({ label, value, sub }: Readonly<CardProps>) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#F3EBE2] p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">{label}</p>
      <p className="text-3xl font-semibold text-[#1A1A1A]">{value}</p>
      {sub && <p className="text-xs text-[#6B6B6B]">{sub}</p>}
    </div>
  );
}

export function StatsCards() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => get<{
      totalMembers: number; verifiedMembers: number;
      activeWorkspaces: number; deskOccupancy: number;
    }>("/dashboard/stats"),
  });

  if (isPending) return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (isError || !data) return null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="TOTAL MEMBERS" value={data.totalMembers} />
      <StatCard label="VERIFIED MEMBERS" value={data.verifiedMembers} />
      <StatCard label="ACTIVE WORKSPACES" value={data.activeWorkspaces} />
      <StatCard label="DESK OCCUPANCY" value={`${data.deskOccupancy}%`} sub="of total capacity" />
    </div>
  );
}
