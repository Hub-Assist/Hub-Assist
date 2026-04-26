"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AttendanceRecord } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { TimePill } from "@/components/ui/TimePill";

interface Props {
  activeRecord?: AttendanceRecord;
}

export function ClockButton({ activeRecord }: Props) {
  const token = useAuthStore((s) => s.token) ?? "";
  const qc = useQueryClient();
  const isClockedIn = !!activeRecord;

  const clockIn = useMutation({
    mutationFn: () => api.clockIn(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const clockOut = useMutation({
    mutationFn: () => api.clockOut(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const isPending = clockIn.isPending || clockOut.isPending;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={() => (isClockedIn ? clockOut.mutate() : clockIn.mutate())}
        disabled={isPending}
        className={`h-40 w-40 rounded-full text-lg font-bold shadow-lg transition-all active:scale-95 disabled:opacity-60 ${
          isClockedIn
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-[#1A1A1A] text-[#F3EBE2] hover:bg-[#2A2A2A]"
        }`}
      >
        {isPending ? "…" : isClockedIn ? "Clock Out" : "Clock In"}
      </button>

      {isClockedIn && activeRecord.clockIn && (
        <TimePill since={activeRecord.clockIn} />
      )}
    </div>
  );
}
