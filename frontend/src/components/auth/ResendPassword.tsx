"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CountDownTimer } from "@/components/ui/CountDownTimer";

const RESEND_SECONDS = 60;

export function ResendPassword({ email }: Readonly<{ email: string }>) {
  const [counting, setCounting] = useState(true);
  const [timerKey, setTimerKey] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExpire = useCallback(() => setCounting(false), []);

  const handleResend = async () => {
    setIsPending(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setCounting(true);
      setTimerKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {counting ? (
        <p className="text-sm text-[#6B6B6B]">
          Resend code in <CountDownTimer key={timerKey} seconds={RESEND_SECONDS} onExpire={handleExpire} />
        </p>
      ) : (
        <Button type="button" variant="soft" disabled={isPending} onClick={handleResend} className="text-sm">
          {isPending ? "Sending…" : "Resend code"}
        </Button>
      )}
      {error && <p className="text-xs text-[#D4916E]">{error}</p>}
    </div>
  );
}
