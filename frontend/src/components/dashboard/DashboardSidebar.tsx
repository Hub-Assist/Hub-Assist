"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  useKeyboardShortcuts,
  formatShortcutLabel,
  type KeyboardShortcut,
} from "@/hooks/useKeyboardShortcuts";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞", shortcutKey: "1" },
  { href: "/dashboard/workspaces", label: "Workspaces", icon: "🏢", shortcutKey: "2" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "📅", shortcutKey: "3" },
  { href: "/dashboard/attendance", label: "Attendance", icon: "🕐", shortcutKey: "4" },
  { href: "/dashboard/profile", label: "Profile", icon: "👤", shortcutKey: "5" },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "⚙️",
    shortcutKey: "6",
    adminOnly: true,
  },
] as const;

interface Props {
  onClose?: () => void;
}

export function DashboardSidebar({ onClose }: Readonly<Props>) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = () => {
    clear();
    router.push("/login");
  };

  const links = NAV.filter(
    (n) => !("adminOnly" in n && n.adminOnly && user?.role !== "admin")
  );

  // Build Alt+[1-N] shortcuts for each visible nav item
  const shortcuts = useMemo<KeyboardShortcut[]>(
    () =>
      links.map((n) => ({
        key: n.shortcutKey,
        alt: true,
        href: n.href,
        label: `Alt+${n.shortcutKey}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [links.map((l) => l.href).join(",")]
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <aside
      className="flex h-full w-64 flex-col bg-card border-r border-text/10"
      aria-label="Main navigation"
    >
      {/* Logo / header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-text/10">
        <span className="text-lg font-semibold text-text">Hubassist</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onClose && (
            <button
              onClick={onClose}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClose();
                }
              }}
              aria-label="Close menu"
              tabIndex={0}
              className="text-text-tertiary hover:text-text lg:hidden rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1"
        aria-label="Sidebar navigation"
      >
        {links.map(({ href, label, icon, shortcutKey }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          const shortcutLabel = formatShortcutLabel({ key: shortcutKey, alt: true });

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              tabIndex={0}
              aria-current={active ? "page" : undefined}
              aria-label={`${label} (${shortcutLabel})`}
              title={`${label} — ${shortcutLabel}`}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
                active
                  ? "bg-text text-canvas"
                  : "text-text-secondary hover:bg-text/5",
              ].join(" ")}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {icon}
              </span>
              <span className="flex-1">{label}</span>
              {/* Keyboard shortcut hint — visible on hover via opacity */}
              <span
                className="ml-auto text-[10px] opacity-0 group-hover:opacity-60 focus-within:opacity-60 tabular-nums"
                aria-hidden="true"
              >
                {shortcutLabel}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-text/10 px-4 py-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-sm font-semibold text-text"
          aria-hidden="true"
        >
          {user?.firstname?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-text">
            {user?.firstname ?? "User"}
          </p>
          <p className="truncate text-xs capitalize text-text-tertiary">
            {user?.role ?? "member"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          tabIndex={0}
          className="shrink-0 rounded-lg p-1.5 text-text-tertiary hover:bg-text/5 hover:text-text transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          ↩
        </button>
      </div>
    </aside>
  );
}
