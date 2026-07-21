"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/apiClient";

export function AdminOverview() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard-admin-stats"],
    queryFn: () => get<{ totalBookings?: number; revenue?: number }>("/dashboard/admin-stats"),
  });

  if (isError) {
    throw new Error("Failed to load admin overview"); // will be caught by ErrorBoundary
  }

  const stats = [
    { label: "TOTAL BOOKINGS", value: isPending ? "—" : (data?.totalBookings ?? 0) },
    { label: "TOTAL REVENUE", value: isPending ? "—" : `$${data?.revenue ?? 0}` },
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
