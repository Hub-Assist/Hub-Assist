"use client";

import { LandingSection } from "@/components/landing/LandingSection";
import { Button } from "@/components/ui/Button";
import { useNewsletterForm } from "@/hooks/useNewsletterForm";

interface NewsletterSectionProps {
  readonly title: string;
  readonly description: string;
}

export function NewsletterSection({ title, description }: Readonly<NewsletterSectionProps>) {
  const { email, onChange, onSubmit } = useNewsletterForm();

  return (
    <LandingSection id="newsletter" backgroundClassName="bg-[#C4CFDE]" className="min-h-[420px]">
      <div className="space-y-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#6B6B6B]">NEWSLETTER</p>
        <h2 className="text-3xl font-bold leading-tight text-[#1A1A1A] sm:text-4xl">{title}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-[#3D3D3D] sm:text-base">{description}</p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-full border border-[#B8C3CF] bg-[#F3EBE2] px-4 py-3 text-sm text-[#6B6B6B]">
              <span>✉️</span>
              <input
                type="email"
                value={email}
                placeholder="Enter your work email"
                onChange={(event) => onChange(event.target.value)}
                className="w-full bg-transparent text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none"
              />
            </label>
            <Button type="submit" className="sm:min-w-44">
              Subscribe
            </Button>
          </form>
          <div className="h-14 w-full rounded-xl bg-[url('https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center sm:h-14 sm:w-56 sm:shrink-0" />
        </div>
      </div>
    </LandingSection>
  );
}
