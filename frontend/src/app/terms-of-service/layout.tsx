import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — HubAssist",
  description:
    "Read the HubAssist Terms of Service covering account usage, workspace bookings, payments, and on-chain transactions.",
  keywords: ["terms of service", "terms and conditions", "legal", "HubAssist", "coworking"],
  openGraph: {
    title: "Terms of Service — HubAssist",
    description:
      "Read the HubAssist Terms of Service covering account usage, workspace bookings, payments, and on-chain transactions.",
    type: "website",
  },
};

export default function TermsOfServiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
