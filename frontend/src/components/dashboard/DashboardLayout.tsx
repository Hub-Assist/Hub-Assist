"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

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
        {/* Mobile topbar */}
        <header className="flex items-center gap-3 border-b border-[#D7CFC6] bg-[#F3EBE2] px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-[#6B6B6B] hover:bg-[#EDE2D6] hover:text-[#1A1A1A]"
          >
            ☰
          </button>
          <span className="text-base font-semibold text-[#1A1A1A]">Hubassist</span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
