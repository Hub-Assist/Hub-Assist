import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
