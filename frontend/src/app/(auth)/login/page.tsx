"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { BiometricLoginView } from "@/components/auth/BiometricLoginView";

export default function LoginPage() {
  const reset = useSearchParams().get("reset");

  const handleBiometric = () => {
    // WebAuthn / biometric flow — to be wired in #66
    alert("Biometric login coming soon");
  };

  return (
    <div className="flex flex-col gap-6">
      {reset === "success" && (
        <div role="status" className="rounded-2xl border border-[#A8C5A0] bg-[#EAF3E8] px-4 py-3 text-sm text-[#1A1A1A]">
          Password reset successfully — sign in with your new password.
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Sign in</h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">Welcome back — enter your details below.</p>
      </div>

      <LoginForm />

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-[#D7CFC6]" />
        <span className="text-xs text-[#6B6B6B]">or</span>
        <hr className="flex-1 border-[#D7CFC6]" />
      </div>

      <BiometricLoginView onTrigger={handleBiometric} />
    </div>
  );
}
