"use client";

import { useEffect, useState } from "react";

const REFUND_WINDOW_HOURS = 24;

export function getRefundDeadline(startTime: string | Date) {
  return new Date(new Date(startTime).getTime() - REFUND_WINDOW_HOURS * 60 * 60 * 1000);
}

export function isRefundEligible(startTime: string | Date, now: Date = new Date()) {
  return getRefundDeadline(startTime).getTime() > now.getTime();
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function RefundCountdown({ startTime }: { startTime: string }) {
  const deadline = getRefundDeadline(startTime);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs <= 0) return null;

  return (
    <p className="text-xs text-[#6B6B6B]" data-testid="refund-countdown">
      Refund eligible until {deadline.toLocaleString()} ({formatRemaining(remainingMs)} remaining)
    </p>
  );
}
