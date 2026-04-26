import type { ReactNode } from "react";

export function ResetPasswordLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Reset password</h2>
        <p className="mt-1 text-sm text-[#6B6B6B]">Enter the code from your email and choose a new password.</p>
      </div>
      {children}
    </div>
  );
}
