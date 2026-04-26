"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Booking } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { Button } from "@/components/ui/Button";

interface Props {
  booking: Booking;
  isAdmin?: boolean;
}

export function BookingActions({ booking, isAdmin }: Props) {
  const token = useAuthStore((s) => s.token) ?? "";
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["booking", booking.id] });
  };

  const confirm = useMutation({
    mutationFn: () => api.confirmBooking(token, booking.id),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(token, booking.id),
    onSuccess: invalidate,
  });

  const isPending = booking.status === "pending";
  const isCancellable = booking.status === "pending" || booking.status === "confirmed";

  if (!isAdmin && !isCancellable) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {isAdmin && isPending && (
        <Button
          variant="dark"
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending}
        >
          {confirm.isPending ? "Confirming…" : "Confirm"}
        </Button>
      )}
      {isCancellable && (
        <Button
          variant="soft"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
        >
          {cancel.isPending ? "Cancelling…" : "Cancel"}
        </Button>
      )}
    </div>
  );
}
