import Link from "next/link";
import type { Booking } from "@/lib/api";
import { BookingStatusBadge } from "./BookingStatusBadge";

interface Props {
  booking: Booking;
  showMember?: boolean;
}

export function BookingCard({ booking, showMember }: Props) {
  return (
    <Link
      href={`/dashboard/bookings/${booking.id}`}
      className="flex flex-col gap-2 rounded-2xl bg-[#F3EBE2] border border-[#D7CFC6] p-4 hover:border-[#1A1A1A] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-[#1A1A1A] text-sm">{booking.workspaceName}</p>
        <BookingStatusBadge status={booking.status} />
      </div>
      {showMember && booking.memberName && (
        <p className="text-xs text-[#6B6B6B]">👤 {booking.memberName}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-[#6B6B6B]">
        <span>📅 {new Date(booking.date).toLocaleDateString()}</span>
        <span>🕐 {booking.startTime} – {booking.endTime}</span>
        <span className="ml-auto font-semibold text-[#1A1A1A]">${booking.amount}</span>
      </div>
    </Link>
  );
}
