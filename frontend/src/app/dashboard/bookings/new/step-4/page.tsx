"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Step4Confirmation } from "@/components/bookings/wizard/Step4Confirmation";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

export default function Step4Page() {
  const router = useRouter();

  useEffect(() => {
    const state = useBookingWizardStore.getState();
    if (!state.lastBookingId) {
      router.replace("/dashboard/bookings/new/step-1");
      return;
    }
    useBookingWizardStore.setState({ currentStep: 4 });
  }, [router]);

  return <Step4Confirmation />;
}
