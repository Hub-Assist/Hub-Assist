import type { ReactNode } from "react";

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#C5BEB6] p-4">
      <div className="w-full max-w-md rounded-[24px] bg-[#F3EBE2] p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Hubassist</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">Workspace management powered by Stellar</p>
        </div>
        {children}
      </div>
    </div>
  );
}
