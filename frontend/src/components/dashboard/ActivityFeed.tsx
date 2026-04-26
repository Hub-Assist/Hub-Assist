"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ActivityFeed() {
  const token = useAuthStore((s) => s.token) ?? "";
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => api.getDashboardActivity(token),
    enabled: !!token,
  });

  if (isPending) return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-[#EDE2D6]" />
      ))}
    </div>
  );

  if (isError || !data?.length) return (
    <p className="text-sm text-[#6B6B6B]">No recent activity.</p>
  );

  return (
    <ul className="flex flex-col gap-2">
      {data.map((item) => (
        <li key={item.id} className="flex items-start gap-3 rounded-xl bg-[#F3EBE2] px-4 py-3">
          <span className="mt-0.5 text-base leading-none">{item.icon}</span>
          <p className="flex-1 text-sm text-[#1A1A1A]">{item.description}</p>
          <span className="shrink-0 text-xs text-[#6B6B6B]">{timeAgo(item.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}
