"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Step3Review } from "@/components/bookings/wizard/Step3Review";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

export default function Step3Page() {
  const router = useRouter();

  useEffect(() => {
    const state = useBookingWizardStore.getState();
    if (!state.canAdvance(1)) {
      router.replace("/dashboard/bookings/new/step-1");
      return;
    }
    if (!state.canAdvance(2)) {
      router.replace("/dashboard/bookings/new/step-2");
      return;
    }
    useBookingWizardStore.setState({ currentStep: 3 });
  }, [router]);

  return (
    <Step3Review
      onBack={() => {
        useBookingWizardStore.getState().prevStep();
        router.push("/dashboard/bookings/new/step-2");
      }}
      onConfirmed={() => {
        router.push("/dashboard/bookings/new/step-4");
      }}
    />
  );
}
