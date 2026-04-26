"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { loginSchema, type LoginFormValues } from "@/lib/schemas/loginSchema";
import { useLoginUser } from "@/hooks/useLoginUser";
import { useAuthStore } from "@/lib/store/authStore";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const { mutate, isPending, error } = useLoginUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (values: LoginFormValues) => {
    mutate(values, {
      onSuccess: ({ access_token }) => {
        setToken(access_token);
        router.push("/dashboard");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {error && (
        <div role="alert" className="rounded-2xl border border-[#D4916E] bg-[#F3EBE2] px-4 py-3 text-sm text-[#1A1A1A]">
          {error.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">EMAIL</label>
        <input
          type="email"
          autoComplete="email"
          placeholder="you@workspace.com"
          {...register("email")}
          className="rounded-full border border-[#D7CFC6] bg-[#EDE2D6] px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
        />
        {errors.email && (
          <p className="text-xs text-[#D4916E]">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">PASSWORD</label>
          <a href="/forgot-password" className="text-xs text-[#3D3D3D] underline hover:text-[#1A1A1A]">
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
          className="rounded-full border border-[#D7CFC6] bg-[#EDE2D6] px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
        />
        {errors.password && (
          <p className="text-xs text-[#D4916E]">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full rounded-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-[#6B6B6B]">
        Don&apos;t have an account?{" "}
        <a href="/auth/register" className="font-semibold text-[#1A1A1A] underline hover:text-[#3D3D3D]">
          Register
        </a>
      </p>
    </form>
  );
}
