import Link from "next/link";
import { LandingSection } from "@/components/landing/LandingSection";

interface FooterSectionProps {
  readonly brand: string;
}

export function FooterSection({ brand }: Readonly<FooterSectionProps>) {
  return (
    <LandingSection backgroundClassName="bg-[#D5DCBA]">
      <div className="grid gap-8 md:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold text-[#1A1A1A]">{brand}</h3>
          <p className="max-w-xl text-sm leading-relaxed text-[#3D3D3D]">
            Workspace management and trustless operations for the next generation of hubs.
          </p>
          <div className="flex gap-4 text-xs text-[#3D3D3D]">
            <Link href="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm text-[#3D3D3D]">
          <div className="space-y-2">
            <p className="font-semibold text-[#1A1A1A]">Product</p>
            <p>Features</p>
            <p>API Docs</p>
            <p>Pricing</p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-[#1A1A1A]">Company</p>
            <p>About</p>
            <p>Blog</p>
            <Link href="/contact" className="hover:underline">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
