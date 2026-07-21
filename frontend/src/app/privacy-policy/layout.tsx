import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — HubAssist",
  description:
    "Learn how HubAssist collects, uses, and protects your personal data across our workspace management platform.",
  keywords: ["privacy policy", "data protection", "GDPR", "HubAssist", "coworking"],
  openGraph: {
    title: "Privacy Policy — HubAssist",
    description:
      "Learn how HubAssist collects, uses, and protects your personal data across our workspace management platform.",
    type: "website",
  },
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
