"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { BiometricLoginView } from "@/components/auth/BiometricLoginView";

export default function LoginPage() {
  const handleBiometric = () => {
    // WebAuthn / biometric flow — to be wired in #66
    alert("Biometric login coming soon");
  };

  return (
    <div className="flex flex-col gap-6">
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
