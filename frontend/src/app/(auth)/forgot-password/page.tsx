import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Forgot password</h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">Enter your email and we&apos;ll send you a reset code.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-[#6B6B6B]">
        Remember your password?{" "}
        <a href="/login" className="font-semibold text-[#1A1A1A] underline hover:text-[#3D3D3D]">Sign in</a>
      </p>
    </div>
  );
}
