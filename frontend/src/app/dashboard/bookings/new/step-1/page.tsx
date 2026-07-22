"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Step1WorkspaceSelect } from "@/components/bookings/wizard/Step1WorkspaceSelect";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

export default function Step1Page() {
  const router = useRouter();

  useEffect(() => {
    useBookingWizardStore.setState({ currentStep: 1 });
  }, []);

  return (
    <Step1WorkspaceSelect
      onNext={() => {
        useBookingWizardStore.getState().nextStep();
        router.push("/dashboard/bookings/new/step-2");
      }}
    />
  );
}
