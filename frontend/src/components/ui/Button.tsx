import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: "dark" | "soft";
}

export function Button({ children, variant = "dark", className = "", ...props }: Readonly<ButtonProps>) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const variants = {
    dark: "bg-[#1A1A1A] text-[#F3EBE2] hover:bg-[#2A2A2A] hover:-translate-y-0.5 focus-visible:ring-[#1A1A1A]",
    soft: "bg-[#D5DCBA] text-[#1A1A1A] hover:bg-[#E8D7C8] hover:-translate-y-0.5 focus-visible:ring-[#D4916E]",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
