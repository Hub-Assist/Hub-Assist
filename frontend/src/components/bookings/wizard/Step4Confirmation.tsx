"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

export function Step4Confirmation() {
  const router = useRouter();
  const lastBookingId = useBookingWizardStore((s) => s.lastBookingId);
  const reset = useBookingWizardStore((s) => s.reset);

  const handleBookAnother = () => {
    reset();
    router.push("/dashboard/bookings/new/step-1");
  };

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <div className="rounded-2xl border border-[#D7CFC6] p-4 flex flex-col gap-2">
        <p className="font-semibold text-[#1A1A1A] text-sm">Booking confirmed</p>
        {lastBookingId && (
          <p className="text-xs text-[#6B6B6B]">Booking ID: {lastBookingId}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={handleBookAnother} className="w-fit">
          Book another
        </Button>
        <Button onClick={() => router.push(`/dashboard/bookings/${lastBookingId}`)} className="w-fit">
          View booking
        </Button>
      </div>
    </div>
  );
}
