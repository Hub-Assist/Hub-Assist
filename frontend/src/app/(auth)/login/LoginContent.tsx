"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { BiometricLoginView } from "@/components/auth/BiometricLoginView";

function LoginContentInner() {
  const reset = useSearchParams().get("reset");
  const [showBiometric, setShowBiometric] = useState(true);

  return (
    <div className="flex flex-col gap-6">
      {reset === "success" && (
        <div role="status" className="rounded-2xl border border-[#A8C5A0] bg-[#EAF3E8] px-4 py-3 text-sm text-text">
          Password reset successfully — sign in with your new password.
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-text">Sign in</h2>
        <p className="mt-1 text-sm text-text-tertiary">Welcome back — enter your details below.</p>
      </div>

      {showBiometric && (
        <>
          <BiometricLoginView onFallback={() => setShowBiometric(false)} />

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-text/20" />
            <span className="text-xs text-text-tertiary">or</span>
            <hr className="flex-1 border-text/20" />
          </div>
        </>
      )}

      <LoginForm />
    </div>
  );
}

export function LoginContent() {
  return (
    <Suspense>
      <LoginContentInner />
    </Suspense>
  );
}
