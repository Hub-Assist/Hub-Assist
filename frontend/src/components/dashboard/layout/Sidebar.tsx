"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/lib/store/authStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NAV_ITEMS } from "./navItems";

export interface SidebarProps {
  /** Only passed in the mobile overlay mode. */
  onClose?: () => void;
  /** Whether the desktop sidebar is in collapsed (icon-only) mode. */
  collapsed?: boolean;
  /** Toggle collapsed state — only rendered on desktop. */
  onToggleCollapse?: () => void;
}

export function Sidebar({ onClose, collapsed = false, onToggleCollapse }: Readonly<SidebarProps>) {
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
