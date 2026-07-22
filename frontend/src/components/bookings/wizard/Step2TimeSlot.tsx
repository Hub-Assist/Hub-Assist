"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useBookingWizardStore, isValidTimeRange } from "@/lib/store/bookingWizardStore";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step2TimeSlot({ onNext, onBack }: Props) {
  const timeSlot = useBookingWizardStore((s) => s.timeSlot);
  const setTimeSlot = useBookingWizardStore((s) => s.setTimeSlot);
  const canAdvance = useBookingWizardStore((s) => s.canAdvance);

  const [startTime, setStartTime] = useState<string>(timeSlot?.startTime ?? "");
  const [endTime, setEndTime] = useState<string>(timeSlot?.endTime ?? "");

  const handleChange = (nextStart: string, nextEnd: string) => {
    setStartTime(nextStart);
    setEndTime(nextEnd);
    setTimeSlot({ startTime: nextStart, endTime: nextEnd });
  };

  const isRangeInvalid = !!startTime && !!endTime && !isValidTimeRange({ startTime, endTime });

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <div>
        <label className="block text-sm font-medium mb-2">Start Time</label>
        <Input
          type="datetime-local"
          value={startTime}
          onChange={(e) => handleChange(e.target.value, endTime)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">End Time</label>
        <Input
          type="datetime-local"
          value={endTime}
          onChange={(e) => handleChange(startTime, e.target.value)}
        />
      </div>

      {isRangeInvalid && (
        <p className="text-sm text-red-600">End time must be after start time</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="w-fit">
          Back
        </Button>
        <Button onClick={onNext} disabled={!canAdvance(2)} className="w-fit">
          Next
        </Button>
      </div>
    </div>
  );
}
