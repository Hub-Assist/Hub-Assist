"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";
import { useCreateBooking } from "@/lib/react-query/hooks/bookings/useCreateBooking";
import { calculateBookingPrice } from "@/lib/booking/calculateBookingPrice";

interface Props {
  onConfirmed: () => void;
  onBack: () => void;
}

export function Step3Review({ onConfirmed, onBack }: Props) {
  const workspaceId = useBookingWizardStore((s) => s.workspaceId);
  const timeSlot = useBookingWizardStore((s) => s.timeSlot);
  const paymentDetails = useBookingWizardStore((s) => s.paymentDetails);
  const setPaymentDetails = useBookingWizardStore((s) => s.setPaymentDetails);
  const completeBooking = useBookingWizardStore((s) => s.completeBooking);
  const { showToast } = useToast();
  const createBooking = useCreateBooking();

  const { data, isLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.getWorkspace(workspaceId as string),
    enabled: !!workspaceId,
  });

  const workspace = data?.workspace;
  const totalPrice =
    workspace && timeSlot
      ? calculateBookingPrice(workspace.pricePerHour, timeSlot.startTime, timeSlot.endTime)
      : 0;

  const handleConfirm = async () => {
    if (!workspaceId || !timeSlot) return;
    try {
      const result = await createBooking.mutateAsync({
        workspaceId,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
      });
      completeBooking(result.booking.id);
      onConfirmed();
    } catch {
      showToast("error", "Failed to create booking");
    }
  };

  if (isLoading) return <p className="text-sm text-[#6B6B6B]">Loading summary…</p>;

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <div className="rounded-2xl border border-[#D7CFC6] p-4 flex flex-col gap-2">
        <p className="font-semibold text-[#1A1A1A] text-sm">{workspace?.name}</p>
        <p className="text-xs text-[#6B6B6B]">
          {timeSlot?.startTime} → {timeSlot?.endTime}
        </p>
        <p className="text-lg font-semibold text-[#1A1A1A]">${totalPrice.toFixed(2)}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={paymentDetails.confirmed}
          onChange={(e) => setPaymentDetails({ confirmed: e.target.checked })}
        />
        I confirm payment of ${totalPrice.toFixed(2)}
      </label>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="w-fit">
          Back
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!paymentDetails.confirmed || createBooking.isPending}
          className="w-fit"
        >
          {createBooking.isPending ? "Booking…" : "Pay & Confirm"}
        </Button>
      </div>
    </div>
  );
}
