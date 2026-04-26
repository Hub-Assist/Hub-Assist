import type { ReactNode } from "react";

interface LandingSectionProps {
  readonly id?: string;
  readonly backgroundClassName?: string;
  readonly children: ReactNode;
}

export function LandingSection({ id, backgroundClassName = "bg-[#F3EBE2]", children }: Readonly<LandingSectionProps>) {
  return (
    <section id={id} className={`rounded-[20px] p-8 sm:p-12 ${backgroundClassName}`}>
      {children}
    </section>
  );
}
