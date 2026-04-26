import type { StepItem } from "@/types/landing";
import { Icon } from "@/components/ui/Icon";
import { LandingSection } from "@/components/landing/LandingSection";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface HowItWorksSectionProps {
  readonly title: string;
  readonly steps: readonly StepItem[];
}

export function HowItWorksSection({ title, steps }: Readonly<HowItWorksSectionProps>) {
  return (
    <LandingSection id="how-it-works" backgroundClassName="bg-[#C3DED8]" className="min-h-[420px]">
      <div className="space-y-6">
        <SectionHeading eyebrow="HOW IT WORKS" title={title} />
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl bg-[#F3EBE2] p-6">
              <div className="mb-3 inline-flex rounded-xl bg-[#EDE2D6] p-2">
                <Icon name={step.icon} />
              </div>
              <h3 className="text-xl font-semibold text-[#1A1A1A]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3D3D3D]">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
