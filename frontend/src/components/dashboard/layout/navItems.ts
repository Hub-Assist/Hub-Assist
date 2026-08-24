import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Settings,
  Building2,
  User,
  ShieldCheck,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
] as const;

/** Items shown in the mobile bottom nav (max 4 to keep touch targets comfortable). */
export const BOTTOM_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
