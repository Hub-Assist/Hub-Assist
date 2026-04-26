import type { LandingContent } from "@/types/landing";

export const landingContent: LandingContent = {
  brand: "Hubassist",
  nav: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Trusted by", href: "#trusted-by" },
    { label: "Newsletter", href: "#newsletter" },
  ],
  heroTagline: "COWORKING OPS, FINANCE, AND ACCESS IN ONE STACK",
  heroTitle: "Powering joyful workspaces with trusted automation.",
  heroDescription:
    "Hubassist unifies booking, memberships, payments, and access control across web, API, and Soroban smart contracts on Stellar.",
  heroStats: [
    { label: "Occupancy", value: "82%" },
    { label: "Recurring memberships", value: "1,240" },
    { label: "On-chain payment confirmations", value: "100%" },
  ],
  featureTitle: "Everything your workspace needs, deeply integrated.",
  features: [
    {
      title: "Operations",
      description: "Desk, room, and resource scheduling with real-time utilization visibility.",
      highlight: "Utilization +34%",
      icon: "buildings",
      tone: "card",
    },
    {
      title: "API + Backend",
      description: "Secure REST APIs for bookings, billing, members, teams, and enterprise policies.",
      highlight: "99.99% API uptime",
      icon: "brackets",
      tone: "lavender",
    },
    {
      title: "On-chain Trust",
      description: "Soroban smart contracts power payments, membership tokens, and access control.",
      highlight: "Zero invoice disputes",
      icon: "shield",
      tone: "sage",
    },
  ],
  howItWorksTitle: "From workspace request to verified access in minutes.",
  steps: [
    {
      title: "01 Connect",
      description: "Import your locations, desks, and member records from current tools.",
      icon: "plug",
    },
    {
      title: "02 Automate",
      description: "Configure billing cycles, token rules, and access policies in one dashboard.",
      icon: "gear",
    },
    {
      title: "03 Verify",
      description: "Members pay and receive on-chain proofs while access unlocks automatically.",
      icon: "check",
    },
  ],
  trustedBy: ["UrbanDesk", "NodeHub", "FlexNest", "AtlasWork"],
  newsletterTitle: "Workspace ideas, product drops, and operator stories.",
  newsletterDescription:
    "Monthly stories on occupancy optimization, blockchain billing, and access security.",
};
