import type { LandingContent } from "@/types/landing";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/landing/Navbar";
import { LandingSection } from "@/components/landing/LandingSection";

interface HeroSectionProps {
  readonly content: LandingContent;
}

export function HeroSection({ content }: Readonly<HeroSectionProps>) {
  return (
    <LandingSection>
      <div className="space-y-10">
        <Navbar brand={content.brand} links={content.nav} />

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#6B6B6B]">{content.heroTagline}</p>
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.02] text-[#1A1A1A] sm:text-6xl lg:text-7xl">
              {content.heroTitle}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#3D3D3D] sm:text-lg">{content.heroDescription}</p>

            <div className="flex flex-wrap items-center gap-3">
              <Button>Start for free</Button>
              <Button variant="soft">See architecture</Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B6B6B]">
              <span className="rounded-full bg-[#2A2A2A] px-4 py-2 text-[#F3EBE2] shadow-sm">Hovered</span>
              <span className="rounded-full border border-[#D4916E] bg-[#E8D7C8] px-4 py-2 text-[#1A1A1A]">Hovered</span>
              <span>Hover states</span>
            </div>
          </div>

          <aside className="space-y-4 rounded-[20px] border border-[#D7CFC6] bg-[#F3EBE2] p-6">
            <h3 className="text-xl font-semibold text-[#1A1A1A]">Live Workspace Pulse</h3>
            <ul className="space-y-2 text-sm text-[#3D3D3D]">
              {content.heroStats.map((stat) => (
                <li key={stat.label} className="flex items-center justify-between rounded-xl bg-[#EDE2D6] px-4 py-3">
                  <span>{stat.label}</span>
                  <span className="font-semibold">{stat.value}</span>
                </li>
              ))}
            </ul>

            <div className="h-28 rounded-full bg-gradient-to-r from-[#F3EBE2] via-[#C4CFDE] to-[#D5DCBA] shadow-[0_10px_18px_rgba(212,145,110,0.28)]" />
            <div className="h-32 rounded-2xl bg-[url('https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center" />
          </aside>
        </div>
      </div>
    </LandingSection>
  );
}
