export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface StatItem {
  readonly label: string;
  readonly value: string;
}

export interface FeatureItem {
  readonly title: string;
  readonly description: string;
  readonly highlight: string;
  readonly icon: "buildings" | "brackets" | "shield";
  readonly tone: "card" | "lavender" | "sage";
}

export interface StepItem {
  readonly title: string;
  readonly description: string;
  readonly icon: "plug" | "gear" | "check";
}

export interface LandingContent {
  readonly brand: string;
  readonly nav: readonly NavItem[];
  readonly heroTagline: string;
  readonly heroTitle: string;
  readonly heroDescription: string;
  readonly heroStats: readonly StatItem[];
  readonly featureTitle: string;
  readonly features: readonly FeatureItem[];
  readonly howItWorksTitle: string;
  readonly steps: readonly StepItem[];
  readonly trustedBy: readonly string[];
  readonly newsletterTitle: string;
  readonly newsletterDescription: string;
}
