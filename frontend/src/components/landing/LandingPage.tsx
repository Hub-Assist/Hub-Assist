import { HubassistLandingPage } from "@/components/landing/HubassistLandingPage";

export interface LandingPageProps {
  readonly className?: string;
}

export function LandingPage(_: Readonly<LandingPageProps>) {  // eslint-disable-line @typescript-eslint/no-unused-vars
  return <HubassistLandingPage />;
}
