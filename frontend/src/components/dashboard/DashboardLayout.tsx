"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Sidebar } from "./layout/Sidebar";
import { BottomNav } from "./layout/BottomNav";

export function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Mobile drawer state — always starts closed
  const [mobileOpen, setMobileOpen] = useState(false);

  // Desktop/tablet collapse state — persisted to localStorage
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    "sidebar-collapsed",
    false,
  );

  // Auto-close mobile drawer on route change (user tapped a link)
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Trap focus / prevent body scroll while mobile overlay is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Desktop / tablet sidebar (md and up) ─────────────────────────── */}
      <div
        data-testid="desktop-sidebar"
        className="hidden md:flex md:shrink-0"
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* ── Mobile sidebar overlay (< md) ────────────────────────────────── */}
      {mobileOpen && (
        <div
          data-testid="mobile-sidebar-overlay"
          className="fixed inset-0 z-40 flex md:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <div className="relative z-50 flex h-full">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar — visible only on < md */}
        <header
          data-testid="mobile-topbar"
          className="flex items-center gap-3 border-b border-text/10 bg-card px-4 py-3 md:hidden"
        >
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-sidebar"
            className="flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-text-tertiary hover:bg-text/5 hover:text-text transition-colors"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="text-base font-semibold text-text">Hubassist</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/*
          Main — adds bottom padding on mobile so the fixed bottom nav
          doesn't overlap page content. On md+ there's no bottom nav.
        */}
        <main className="flex-1 p-4 sm:p-6 pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────────────────────────────── */}
      <BottomNav />
    </div>
  );
}
