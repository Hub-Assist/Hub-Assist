"use client";

import { useRouter } from "next/navigation";
import { useBookingWizardStore, type WizardStep } from "@/lib/store/bookingWizardStore";

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Select Workspace" },
  { step: 2, label: "Choose Time Slot" },
  { step: 3, label: "Review & Pay" },
  { step: 4, label: "Confirmation" },
];

export function BookingWizardProgress() {
  const router = useRouter();
  const currentStep = useBookingWizardStore((s) => s.currentStep);
  const goToStep = useBookingWizardStore((s) => s.goToStep);

  const handleStepClick = (step: WizardStep) => {
    if (step >= currentStep) return;
    goToStep(step);
    router.push(`/dashboard/bookings/new/step-${step}`);
  };

  return (
    <ol className="flex items-center gap-2">
      {STEPS.map(({ step, label }, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <li key={step} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepClick(step)}
              disabled={!isCompleted}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-[#1A1A1A] text-[#F3EBE2]"
                  : isCompleted
                    ? "bg-[#D7CFC6] text-[#1A1A1A] hover:bg-[#C5BEB6]"
                    : "bg-[#EDE2D6] text-[#6B6B6B] cursor-default"
              }`}
            >
              <span>{step}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <span className="h-px w-4 bg-[#D7CFC6]" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
