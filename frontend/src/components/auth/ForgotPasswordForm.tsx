"use client";

import { useState } from "react";
import { post } from "@/lib/apiClient";
import { EmailResetPassword } from "@/components/auth/EmailResetPassword";

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (email: string) => {
    setIsPending(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#D7CFC6] bg-[#EDE2D6] px-4 py-5 text-sm text-[#1A1A1A]">
        Check your inbox — we&apos;ve sent a password reset code to your email address.
      </div>
    );
  }

  return <EmailResetPassword onSubmit={handleSubmit} isPending={isPending} error={error} />;
}
