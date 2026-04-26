import { landingContent } from "@/data/landingData";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { NewsletterSection } from "@/components/landing/NewsletterSection";
import { TrustedBySection } from "@/components/landing/TrustedBySection";

export function HubassistLandingPage() {
  return (
    <main className="min-h-screen bg-[#C5BEB6] p-1.5">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-1.5">
        <HeroSection content={landingContent} />
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-stretch">
          <div className="flex flex-1 flex-col">
            <FeaturesSection title={landingContent.featureTitle} features={landingContent.features} />
          </div>
          <div className="flex flex-1 flex-col">
            <HowItWorksSection title={landingContent.howItWorksTitle} steps={landingContent.steps} />
          </div>
          <div className="flex flex-1 flex-col">
            <NewsletterSection
              title={landingContent.newsletterTitle}
              description={landingContent.newsletterDescription}
            />
          </div>
        </div>
        <TrustedBySection companies={landingContent.trustedBy} />
        <FooterSection brand={landingContent.brand} />
      </div>
    </main>
  );
}
