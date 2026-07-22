import type { ReactNode } from "react";
import { BookingWizardProgress } from "@/components/bookings/wizard/BookingWizardProgress";

export default function BookingWizardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-[#1A1A1A]">New Booking</h1>
      <BookingWizardProgress />
      {children}
    </div>
  );
}
