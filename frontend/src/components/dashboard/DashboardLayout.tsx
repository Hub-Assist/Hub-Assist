"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuthStore } from "@/lib/store/authStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// ---------------------------------------------------------------------------
// Navigation definition
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, adminOnly: true },
] as const;

/** Items shown in the mobile bottom nav (max 4 to keep touch targets comfortable). */
const BOTTOM_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

interface SidebarProps {
  /** Only passed in the mobile overlay mode. */
  onClose?: () => void;
  /** Whether the desktop sidebar is in collapsed (icon-only) mode. */
  collapsed?: boolean;
  /** Toggle collapsed state — only rendered on desktop. */
  onToggleCollapse?: () => void;
}

function Sidebar({ onClose, collapsed = false, onToggleCollapse }: Readonly<SidebarProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = () => {
    clear();
    router.push("/login");
  };

  const links = NAV_ITEMS.filter(
    (n) => !("adminOnly" in n && n.adminOnly && user?.role !== "admin"),
  );

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "flex h-full flex-col bg-card border-r border-text/10 transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header — logo + controls */}
      <div
        className={cn(
          "flex items-center border-b border-text/10 py-4",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        {!collapsed && (
          <span className="text-lg font-semibold text-text">Hubassist</span>
        )}

        <div className={cn("flex items-center gap-1", collapsed && "flex-col gap-2")}>
          {!collapsed && <ThemeToggle />}

          {/* Collapse toggle — desktop only */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden md:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-text-tertiary hover:bg-text/5 hover:text-text transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}

          {/* Close button — mobile overlay only */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-text-tertiary hover:bg-text/5 hover:text-text transition-colors md:hidden"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                "min-h-[44px]", // WCAG touch target
                collapsed ? "justify-center" : "px-3",
                active
                  ? "bg-text text-canvas"
                  : "text-text-secondary hover:bg-text/5",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div
        className={cn(
          "border-t border-text/10 py-3 flex items-center gap-3",
          collapsed ? "flex-col px-2" : "px-4",
        )}
      >
        {/* Avatar */}
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-semibold text-text"
        >
          {user?.firstname?.[0]?.toUpperCase() ?? "?"}
        </div>

        {/* Name + role — hidden when collapsed */}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-text">
              {user?.firstname ?? "User"}
            </p>
            <p className="truncate text-xs capitalize text-text-tertiary">
              {user?.role ?? "member"}
            </p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="shrink-0 flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-text-tertiary hover:bg-text/5 hover:text-text transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom navigation
// ---------------------------------------------------------------------------

function BottomNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const visibleItems = BOTTOM_NAV_ITEMS.filter(
    (n) => !("adminOnly" in n && (n as { adminOnly?: boolean }).adminOnly && user?.role !== "admin"),
  );

  return (
    <nav
      aria-label="Mobile bottom navigation"
      // pb-safe is handled by the CSS var fallback in globals.css
      className="fixed bottom-0 inset-x-0 z-30 flex border-t border-text/10 bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
              "min-h-[56px]", // generous touch target (>44px)
              active ? "text-text" : "text-text-tertiary hover:text-text",
            )}
          >
            <Icon
              className={cn("h-5 w-5", active && "stroke-[2.5]")}
              aria-hidden
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// DashboardLayout
// ---------------------------------------------------------------------------

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
