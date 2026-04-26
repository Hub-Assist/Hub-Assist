"use client";

import { Suspense, useRef, useState, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ResendButton } from "@/components/auth/ResendButton";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}***@${domain}`;
}

const inputClass =
  "h-12 w-12 rounded-xl border border-[#D7CFC6] bg-[#EDE2D6] text-center text-lg font-semibold text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] caret-transparent";

function VerifyOtpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (i: number) => refs.current[i]?.focus();

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ""; setDigits(next); }
      else if (i > 0) { next[i - 1] = ""; setDigits(next); focus(i - 1); }
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    e.preventDefault();
    const next = [...digits];
    next[i] = e.key;
    setDigits(next);
    if (i < 5) focus(i + 1);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setDigits(next);
    focus(Math.min(pasted.length, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = digits.join("");
    if (otp.length < 6) { setError("Please enter all 6 digits."); return; }
    setError(null);
    setIsPending(true);
    try {
      await api.verifyOtp(email, otp);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Verify your email</h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          Enter the 6-digit code sent to <span className="font-medium text-[#1A1A1A]">{maskEmail(email)}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div role="alert" className="rounded-2xl border border-[#D4916E] bg-[#F3EBE2] px-4 py-3 text-sm text-[#1A1A1A]">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
              className={inputClass}
              onChange={() => {}}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
            />
          ))}
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <ResendButton email={email} />
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpContent />
    </Suspense>
  );
}
