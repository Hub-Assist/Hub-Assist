import Link from "next/link";

const btnClass =
  "inline-flex items-center gap-2 rounded-full bg-[#D5DCBA] px-5 py-2.5 text-sm font-semibold text-[#1A1A1A] transition duration-200 hover:bg-[#E8D7C8] hover:-translate-y-0.5";

const ACTIONS = [
  { label: "New Booking", href: "/dashboard/bookings/new", icon: "📅" },
  { label: "Invite Member", href: "/dashboard/members/invite", icon: "✉️" },
  { label: "View Reports", href: "/dashboard/reports", icon: "📊" },
] as const;

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {ACTIONS.map(({ label, href, icon }) => (
        <Link key={href} href={href} className={btnClass}>
          <span>{icon}</span>{label}
        </Link>
      ))}
    </div>
  );
}
