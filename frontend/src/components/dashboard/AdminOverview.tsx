"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";

export function AdminOverview() {
  const token = useAuthStore((s) => s.token) ?? "";
  const { data, isPending } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(token),
    enabled: !!token,
  });

  const stats = [
    { label: "PENDING BOOKINGS", value: isPending ? "—" : (data?.pendingBookings ?? 0) },
    { label: "REVENUE THIS MONTH", value: isPending ? "—" : `$${data?.revenueThisMonth ?? 0}` },
  ];

  return (
    <div className="rounded-2xl border border-[#D7CFC6] bg-[#F3EBE2] p-5">
      <p className="mb-4 text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">ADMIN OVERVIEW</p>
      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-[#6B6B6B]">{label}</p>
            <p className="text-2xl font-semibold text-[#1A1A1A]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
