"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { BookingStatusBadge } from "@/components/bookings/BookingStatusBadge";
import { BookingActions } from "@/components/bookings/BookingActions";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.token) ?? "";
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api.getBooking(id),
    enabled: !!token && !!id,
  });

  if (isLoading) return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="h-6 w-16 bg-[#EDE2D6] rounded animate-pulse" />
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-[#EDE2D6] rounded animate-pulse" />
        <div className="h-6 w-24 bg-[#EDE2D6] rounded-full animate-pulse" />
      </div>
      <div className="h-48 bg-[#EDE2D6] rounded-2xl animate-pulse" />
    </div>
  );
  
  if (isError) return (
    <div className="flex flex-col gap-6 max-w-lg">
      <button onClick={() => router.back()} className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] w-fit">← Back</button>
      <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
        Failed to load booking details. Please try again.
      </div>
    </div>
  );
  
  if (!booking) return <p className="text-sm text-[#6B6B6B]">Booking not found.</p>;

  const rows: [string, string][] = [
    ["Workspace", booking.workspaceName],
    ["Date", new Date(booking.date).toLocaleDateString()],
    ["Time", `${booking.startTime} – ${booking.endTime}`],
    ["Amount", `$${booking.amount}`],
    ...(isAdmin && booking.memberName ? [["Member", booking.memberName] as [string, string]] : []),
  ];

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <button
        onClick={() => router.back()}
        className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] w-fit"
      >
        ← Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Booking Detail</h1>
        <BookingStatusBadge status={booking.status} />
      </div>

      <div className="rounded-2xl border border-[#D7CFC6] bg-[#F3EBE2] divide-y divide-[#D7CFC6]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between px-5 py-3 text-sm">
            <span className="text-[#6B6B6B]">{label}</span>
            <span className="font-medium text-[#1A1A1A]">{value}</span>
          </div>
        ))}
      </div>

      <BookingActions booking={booking} isAdmin={isAdmin} />
    </div>
  );
}
