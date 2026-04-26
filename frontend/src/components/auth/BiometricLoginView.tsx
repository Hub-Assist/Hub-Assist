"use client";

export function BiometricLoginView({ onTrigger }: { readonly onTrigger: () => void }) {
  return (
    <button
      type="button"
      onClick={onTrigger}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-[#D7CFC6] bg-[#F3EBE2] px-5 py-3 text-sm font-semibold text-[#1A1A1A] transition duration-200 hover:bg-white hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]"
    >
      <span>🪪</span> Sign in with Biometrics
    </button>
  );
}
