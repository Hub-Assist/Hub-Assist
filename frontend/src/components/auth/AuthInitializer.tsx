"use client";

import { useAuthInit } from "@/lib/hooks/useAuthInit";
import { SessionTimeoutDialog } from "@/components/auth/SessionTimeoutDialog";

/**
 * Component that initializes auth state from storage on app mount
 * Should be included in the root layout or providers
 */
export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return (
    <>
      {children}
      <SessionTimeoutDialog />
    </>
  );
}