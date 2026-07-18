"use client";

import { useConfirmBooking } from "@/lib/react-query/hooks/bookings/useConfirmBooking";
import { useCancelBooking } from "@/lib/react-query/hooks/bookings/useCancelBooking";
import { Button } from "@/components/ui/Button";
import type { Booking } from "@/lib/apiClient";

interface Props {
  booking: Booking;
  isAdmin?: boolean;
}

export function BookingActions({ booking, isAdmin }: Props) {
  const confirm = useConfirmBooking();
  const cancel = useCancelBooking();

  const isMutating = confirm.isPending || cancel.isPending;
  const isPending = booking.status === "pending";
  const isCancellable = booking.status === "pending" || booking.status === "confirmed";

  if (!isAdmin && !isCancellable) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {isAdmin && isPending && (
          <Button
            variant="primary"
            onClick={() => confirm.mutate(booking.id)}
            disabled={isMutating}
          >
            {confirm.isPending ? "Confirming…" : "Confirm"}
          </Button>
        )}
        {isCancellable && (
          <Button
            variant="ghost"
            onClick={() => cancel.mutate(booking.id)}
            disabled={isMutating}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel"}
          </Button>
        )}
      </div>
      {isMutating && (
        <p className="text-xs text-[#6B6B6B] flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#6B6B6B] animate-pulse" />
          Syncing with server…
        </p>
      )}
    </div>
  );
}
