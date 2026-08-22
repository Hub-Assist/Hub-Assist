"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/lib/store/authStore";
import { BOTTOM_NAV_ITEMS } from "./navItems";

export function BottomNav() {
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
