"use client";

import { useState } from "react";
import { useConfirmBooking } from "@/lib/react-query/hooks/bookings/useConfirmBooking";
import { useCancelBooking } from "@/lib/react-query/hooks/bookings/useCancelBooking";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { isRefundEligible } from "@/components/bookings/RefundCountdown";
import type { Booking } from "@/lib/apiClient";

interface Props {
  booking: Booking;
  isAdmin?: boolean;
}

const CONFIRM_TEXT = "CANCEL";

export function BookingActions({ booking, isAdmin }: Props) {
  const confirm = useConfirmBooking();
  const cancel = useCancelBooking();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const isMutating = confirm.isPending || cancel.isPending;
  const isPending = booking.status === "pending";
  const isCancellable = booking.status === "pending" || booking.status === "confirmed";
  const showCancelButton = isAdmin || isCancellable;

  if (!isAdmin && !isCancellable) return null;

  const refundPreview = isRefundEligible(booking.startTime) ? booking.amount : 0;

  const handleConfirmCancel = () => {
    cancel.mutate(booking.id, {
      onSuccess: () => {
        setShowCancelModal(false);
        setConfirmText("");
      },
    });
  };

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
        {showCancelButton && (
          <Button
            variant="ghost"
            onClick={() => setShowCancelModal(true)}
            disabled={isMutating || !isCancellable}
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

      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B6B6B]">
            This action cannot be undone. Estimated refund:{" "}
            <span className="font-medium text-[#1A1A1A]">${refundPreview.toFixed(2)}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#6B6B6B]" htmlFor="cancel-confirm-input">
              Type &quot;{CONFIRM_TEXT}&quot; to confirm
            </label>
            <input
              id="cancel-confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="border border-[#D7CFC6] rounded-md px-3 py-2 text-sm"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)} disabled={cancel.isPending}>
              Keep booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={confirmText !== CONFIRM_TEXT || cancel.isPending}
            >
              {cancel.isPending ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
