import { LandingSection } from "@/components/landing/LandingSection";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface TrustedBySectionProps {
  readonly companies: readonly string[];
}

export function TrustedBySection({ companies }: Readonly<TrustedBySectionProps>) {
  const items = [...companies, ...companies, ...companies, ...companies]; // 4x for seamless fill

  return (
    <LandingSection id="trusted-by">
      <div className="space-y-6">
        <SectionHeading eyebrow="TRUSTED BY" title="Growing teams and enterprise hubs rely on Hubassist." />
        <div className="overflow-hidden">
          <div
            className="flex gap-3"
            style={{ animation: "marquee 12s linear infinite", width: "max-content" }}
          >
            {items.map((company, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#F8F3ED] px-8 py-5 text-sm font-medium text-[#3D3D3D] whitespace-nowrap transition hover:bg-white"
              >
                {company}
              </div>
            ))}
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
