"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordLayout } from "@/components/auth/ResetPasswordLayout";
import { ResetPasswordCard } from "@/components/auth/ResetPasswordCard";

function ResetPasswordContent() {
  const email = useSearchParams().get("email") ?? "";

  return (
    <ResetPasswordLayout>
      <ResetPasswordCard email={email} />
    </ResetPasswordLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
