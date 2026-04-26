"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";

const schema = z.object({ email: z.string().email("Enter a valid email address") });
type Values = z.infer<typeof schema>;

interface Props {
  onSubmit: (email: string) => Promise<void>;
  isPending: boolean;
  error: string | null;
}

const inputClass =
  "w-full rounded-full border border-[#D7CFC6] bg-[#EDE2D6] px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]";

export function EmailResetPassword({ onSubmit, isPending, error }: Readonly<Props>) {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v.email))} className="flex flex-col gap-5">
      {error && (
        <div role="alert" className="rounded-2xl border border-[#D4916E] bg-[#F3EBE2] px-4 py-3 text-sm text-[#1A1A1A]">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold tracking-[0.1em] text-[#6B6B6B]">EMAIL</label>
        <input type="email" autoComplete="email" placeholder="you@workspace.com" {...register("email")} className={inputClass} />
        {errors.email && <p className="text-xs text-[#D4916E]">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Send reset code"}
      </Button>
    </form>
  );
}
