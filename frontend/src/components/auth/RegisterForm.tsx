"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { registerSchema, type RegisterFormValues } from "@/lib/schemas/registerSchema";
import { useRegisterUser } from "@/hooks/useRegisterUser";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full rounded-full border border-[#D7CFC6] bg-[#EDE2D6] px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]";

export function RegisterForm() {
  const router = useRouter();
  const { mutate, isPending, error } = useRegisterUser();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = (values: RegisterFormValues) => {
    const { confirmPassword: _c, ...payload } = values; // eslint-disable-line @typescript-eslint/no-unused-vars
    mutate(payload, {
      onSuccess: () => router.push(`/auth/verify-otp?email=${encodeURIComponent(payload.email)}`),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-2xl border border-[#D4916E] bg-[#F3EBE2] px-4 py-3 text-sm text-[#1A1A1A]">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">FIRST NAME</label>
          <input placeholder="Jane" {...register("firstname")} className={inputClass} />
          {errors.firstname && <p className="text-xs text-[#D4916E]">{errors.firstname.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">LAST NAME</label>
          <input placeholder="Doe" {...register("lastname")} className={inputClass} />
          {errors.lastname && <p className="text-xs text-[#D4916E]">{errors.lastname.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">EMAIL</label>
        <input type="email" autoComplete="email" placeholder="you@workspace.com" {...register("email")} className={inputClass} />
        {errors.email && <p className="text-xs text-[#D4916E]">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">PASSWORD</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("password")}
            className={`${inputClass} pr-11`}
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide" : "Show"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A]">
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
        {errors.password && <p className="text-xs text-[#D4916E]">{errors.password.message}</p>}
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

      <Button type="submit" disabled={isPending} className="w-full rounded-full mt-1">
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Creating account…
          </span>
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-[#6B6B6B]">
        Already have an account?{" "}
        <a href="/login" className="font-semibold text-[#1A1A1A] underline hover:text-[#3D3D3D]">
          Sign in
        </a>
      </p>
    </form>
  );
}
