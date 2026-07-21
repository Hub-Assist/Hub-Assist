"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type BookingStatus } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { BookingCard } from "@/components/bookings/BookingCard";
import { useFiltersWithUrl, type FilterSchema } from "@/hooks/useFiltersWithUrl";
import { enumCodec } from "@/lib/filters/codecs";

type BookingTab = BookingStatus | "all";

const TABS: { label: string; value: BookingTab }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Cancelled", value: "cancelled" },
];

interface BookingsFilters {
  tab: BookingTab;
}

const DEFAULT_BOOKINGS_FILTERS: BookingsFilters = { tab: "all" };

const BOOKINGS_FILTERS_SCHEMA: FilterSchema<BookingsFilters> = {
  tab: enumCodec(TABS.map((t) => t.value)),
};

function BookingsContent() {
  const token = useAuthStore((s) => s.token) ?? "";
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [{ tab }, setFilters] = useFiltersWithUrl(DEFAULT_BOOKINGS_FILTERS, BOOKINGS_FILTERS_SCHEMA);

  const { data: bookings = [], isLoading, isError } = useQuery({
    queryKey: ["bookings", tab],
    queryFn: () => api.getBookings(tab === "all" ? undefined : tab),
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
            onClick={() => setFilters({ tab: t.value })}
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
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#EDE2D6] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
          Failed to load bookings. Please try again.
        </div>
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

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsContent />
    </Suspense>
  );
}
