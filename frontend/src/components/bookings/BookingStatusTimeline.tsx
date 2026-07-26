import type { Booking } from "@/lib/apiClient";

interface Step {
  label: string;
  timestamp?: string;
  filled: boolean;
}

function formatTimestamp(value?: string) {
  if (!value) return undefined;
  return new Date(value).toLocaleString();
}

export function BookingStatusTimeline({ booking }: { booking: Booking }) {
  const isCancelled = booking.status === "cancelled";
  const isCompleted = booking.status === "completed";
  const isConfirmedOrLater = booking.status === "confirmed" || isCompleted;

  const steps: Step[] = [
    {
      label: "Created",
      timestamp: formatTimestamp(booking.createdAt),
      filled: true,
    },
    {
      label: "Confirmed",
      timestamp: isConfirmedOrLater ? formatTimestamp(booking.updatedAt) : undefined,
      filled: isConfirmedOrLater,
    },
    {
      label: isCancelled ? "Cancelled" : "Completed",
      timestamp: isCancelled || isCompleted ? formatTimestamp(booking.updatedAt) : undefined,
      filled: isCancelled || isCompleted,
    },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="booking-status-timeline">
      {steps.map((step, i) => (
        <div key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              data-testid={`timeline-step-${step.label.toLowerCase()}`}
              data-filled={step.filled}
              className={`h-3 w-3 rounded-full ${
                step.filled ? "bg-[#1A1A1A]" : "bg-[#D7CFC6]"
              }`}
            />
            {i < steps.length - 1 && (
              <span className={`w-px flex-1 min-h-[1.5rem] ${step.filled ? "bg-[#1A1A1A]" : "bg-[#D7CFC6]"}`} />
            )}
          </div>
          <div className="pb-2">
            <p className={`text-sm font-medium ${step.filled ? "text-[#1A1A1A]" : "text-[#6B6B6B]"}`}>
              {step.label}
            </p>
            {step.timestamp && <p className="text-xs text-[#6B6B6B]">{step.timestamp}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
