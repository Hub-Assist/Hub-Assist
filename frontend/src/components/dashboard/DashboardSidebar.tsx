"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/dashboard/workspaces", label: "Workspaces", icon: "🏢" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "📅" },
  { href: "/dashboard/attendance", label: "Attendance", icon: "🕐" },
  { href: "/dashboard/profile", label: "Profile", icon: "👤" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️", adminOnly: true },
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

  const links = NAV.filter((n) => !("adminOnly" in n && n.adminOnly && user?.role !== "admin"));

  return (
    <aside className="flex h-full w-64 flex-col bg-[#F3EBE2] border-r border-[#D7CFC6]">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7CFC6]">
        <span className="text-lg font-semibold text-[#1A1A1A]">Hubassist</span>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="text-[#6B6B6B] hover:text-[#1A1A1A] lg:hidden">
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#1A1A1A] text-[#F3EBE2]"
                  : "text-[#3D3D3D] hover:bg-[#EDE2D6]"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-[#D7CFC6] px-4 py-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D5DCBA] text-sm font-semibold text-[#1A1A1A]">
          {user?.firstname?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-[#1A1A1A]">{user?.firstname ?? "User"}</p>
          <p className="truncate text-xs capitalize text-[#6B6B6B]">{user?.role ?? "member"}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="shrink-0 rounded-lg p-1.5 text-[#6B6B6B] hover:bg-[#EDE2D6] hover:text-[#1A1A1A] transition-colors"
        >
          ↩
        </button>
      </div>
    </aside>
  );
}
