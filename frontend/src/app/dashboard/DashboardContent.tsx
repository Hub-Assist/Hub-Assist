"use client";

import { useAuthStore } from "@/lib/store/authStore";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AdminOverview } from "@/components/dashboard/AdminOverview";

export function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">Here&apos;s what&apos;s happening in your workspace today.</p>
      </div>

      <QuickActions />

      <StatsCards />

      {isAdmin && <AdminOverview />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] p-5">
          <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">MEMBER GROWTH — LAST 7 DAYS</p>
          <AnalyticsChart />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-[#F3EBE2] p-5">
          <p className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">RECENT ACTIVITY</p>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
