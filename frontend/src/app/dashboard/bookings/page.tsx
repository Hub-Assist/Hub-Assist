"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type BookingStatus } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { BookingCard } from "@/components/bookings/BookingCard";

const TABS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function BookingsPage() {
  const token = useAuthStore((s) => s.token) ?? "";
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<BookingStatus | "all">("all");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", tab],
    queryFn: () => api.getBookings(token, tab === "all" ? undefined : tab),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-[#1A1A1A]">Bookings</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-[#EDE2D6] p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-[#1A1A1A] text-[#F3EBE2]"
                : "text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-[#6B6B6B]">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-[#6B6B6B]">No bookings found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} showMember={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
