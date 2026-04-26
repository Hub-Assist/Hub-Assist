"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/schemas/resetPasswordSchema";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ResendPassword } from "@/components/auth/ResendPassword";

const inputClass =
  "w-full rounded-full border border-[#D7CFC6] bg-[#EDE2D6] px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]";

export function ResetPasswordCard({ email }: Readonly<{ email: string }>) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } =
    useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async ({ otp, newPassword }: ResetPasswordValues) => {
    try {
      await api.resetPassword(email, otp, newPassword);
      router.push("/login?reset=success");
    } catch (e) {
      setError("root", { message: e instanceof Error ? e.message : "Invalid or expired code." });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {errors.root && (
        <div role="alert" className="rounded-2xl border border-[#D4916E] bg-[#F3EBE2] px-4 py-3 text-sm text-[#1A1A1A]">
          {errors.root.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">RESET CODE</label>
        <input placeholder="6-digit code" maxLength={6} {...register("otp")} className={inputClass} />
        {errors.otp && <p className="text-xs text-[#D4916E]">{errors.otp.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">NEW PASSWORD</label>
        <div className="relative">
          <input
            type={showNew ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("newPassword")}
            className={`${inputClass} pr-11`}
          />
          <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? "Hide" : "Show"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A]">
            {showNew ? "🙈" : "👁️"}
          </button>
        </div>
        {errors.newPassword && <p className="text-xs text-[#D4916E]">{errors.newPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">CONFIRM PASSWORD</label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("confirmPassword")}
            className={`${inputClass} pr-11`}
          />
          <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide" : "Show"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A]">
            {showConfirm ? "🙈" : "👁️"}
          </button>
        </div>
        {errors.confirmPassword && <p className="text-xs text-[#D4916E]">{errors.confirmPassword.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Resetting…" : "Reset password"}
      </Button>

      <ResendPassword email={email} />
    </form>
  );
}
