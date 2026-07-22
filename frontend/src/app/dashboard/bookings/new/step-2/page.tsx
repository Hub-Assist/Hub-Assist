"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Step2TimeSlot } from "@/components/bookings/wizard/Step2TimeSlot";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

export default function Step2Page() {
  const router = useRouter();

  useEffect(() => {
    const state = useBookingWizardStore.getState();
    if (!state.canAdvance(1)) {
      router.replace("/dashboard/bookings/new/step-1");
      return;
    }
    useBookingWizardStore.setState({ currentStep: 2 });
  }, [router]);

  return (
    <Step2TimeSlot
      onBack={() => {
        useBookingWizardStore.getState().prevStep();
        router.push("/dashboard/bookings/new/step-1");
      }}
      onNext={() => {
        useBookingWizardStore.getState().nextStep();
        router.push("/dashboard/bookings/new/step-3");
      }}
    />
  );
}
