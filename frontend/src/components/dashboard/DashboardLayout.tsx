"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Header } from "@/components/dashboard/Header";

export function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#C5BEB6]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <DashboardSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="relative z-50 flex h-full">
            <DashboardSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onOpenMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
