"use client";

import { useSearchParams } from "next/navigation";
import { ResetPasswordLayout } from "@/components/auth/ResetPasswordLayout";
import { ResetPasswordCard } from "@/components/auth/ResetPasswordCard";

export default function ResetPasswordPage() {
  const email = useSearchParams().get("email") ?? "";

  return (
    <ResetPasswordLayout>
      <ResetPasswordCard email={email} />
    </ResetPasswordLayout>
  );
}
