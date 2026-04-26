import type { FeatureItem } from "@/types/landing";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LandingSection } from "@/components/landing/LandingSection";

interface FeaturesSectionProps {
  readonly title: string;
  readonly features: readonly FeatureItem[];
}

const tones: Record<FeatureItem["tone"], string> = {
  card: "bg-[#F3EBE2] border-[#D7CFC6]",
  lavender: "bg-[#C4CFDE] border-[#A8B5C6]",
  sage: "bg-[#D5DCBA] border-[#B8C293]",
};

export function FeaturesSection({ title, features }: Readonly<FeaturesSectionProps>) {
  return (
    <LandingSection id="features" className="min-h-[420px]">
      <div className="space-y-6">
        <SectionHeading eyebrow="FEATURES" title={title} />
        <div className="grid gap-4 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`rounded-2xl border p-6 transition duration-200 hover:-translate-y-1 ${tones[feature.tone]}`}
            >
              <div className="mb-3 inline-flex rounded-xl bg-white/45 p-2">
                <Icon name={feature.icon} />
              </div>
              <h3 className="text-xl font-semibold text-[#1A1A1A]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3D3D3D]">{feature.description}</p>
              <p className="mt-4 text-sm font-semibold text-[#1E8A57]">{feature.highlight}</p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
