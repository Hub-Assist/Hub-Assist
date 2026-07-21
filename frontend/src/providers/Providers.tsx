"use client";

import type { ReactNode } from "react";
import { ReactQueryProvider } from "./ReactQueryProvider";
import { AuthInitializer } from "./AuthInitializer";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { NotificationsInitializer } from "./NotificationsInitializer";

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <ReactQueryProvider>
      <ToastProvider>
        <AuthInitializer />
        <NotificationsInitializer />
        {children}
      </ToastProvider>
    </ReactQueryProvider>
  );
}
