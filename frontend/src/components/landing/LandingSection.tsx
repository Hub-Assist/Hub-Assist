import type { ReactNode } from "react";

interface LandingSectionProps {
  readonly id?: string;
  readonly backgroundClassName?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function LandingSection({ id, backgroundClassName = "bg-[#F3EBE2]", className = "", children }: Readonly<LandingSectionProps>) {
  return (
    <section id={id} className={`flex flex-1 flex-col rounded-[20px] p-8 sm:p-12 ${backgroundClassName} ${className}`.trim()}>
      {children}
    </section>
  );
}
