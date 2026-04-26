import { LandingSection } from "@/components/landing/LandingSection";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface TrustedBySectionProps {
  readonly companies: readonly string[];
}

export function TrustedBySection({ companies }: Readonly<TrustedBySectionProps>) {
  return (
    <LandingSection id="trusted-by">
      <div className="space-y-6">
        <SectionHeading eyebrow="TRUSTED BY" title="Growing teams and enterprise hubs rely on Hubassist." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {companies.map((company) => (
            <div
              key={company}
              className="rounded-2xl bg-[#F8F3ED] px-4 py-5 text-center text-sm font-medium text-[#3D3D3D] transition hover:bg-white"
            >
              {company}
            </div>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
