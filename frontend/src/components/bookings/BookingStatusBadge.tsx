import type { BookingStatus } from "@/lib/api";

const styles: Record<BookingStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  confirmed: "bg-[#D5DCBA] text-[#1A1A1A]",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-gray-200 text-[#6B6B6B]",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
