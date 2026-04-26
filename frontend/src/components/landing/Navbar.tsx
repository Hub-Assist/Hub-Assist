import type { NavItem } from "@/types/landing";
import { Button } from "@/components/ui/Button";

export interface NavbarProps {
  readonly brand: string;
  readonly links: readonly NavItem[];
}

export function Navbar({ brand, links }: Readonly<NavbarProps>) {
  return (
    <nav className="flex items-center justify-between gap-6">
      <span className="text-xl font-medium tracking-tight text-[#1A1A1A]">{brand}</span>

      <div className="hidden items-center gap-7 md:flex">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-sm text-[#3D3D3D] transition-colors hover:text-[#1A1A1A]"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <a href="/login" className="text-sm font-semibold text-[#3D3D3D] transition-colors hover:text-[#1A1A1A]">
          Sign in
        </a>
        <Button>Book a demo</Button>
      </div>
    </nav>
  );
}
