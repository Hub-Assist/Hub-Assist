import { Suspense } from "react";
import type { ReactNode } from "react";

export default function NewsletterPreferencesLayout({ children }: { readonly children: ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
