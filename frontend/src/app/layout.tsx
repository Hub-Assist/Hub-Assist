import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "HubAssist — Workspace Management",
  description:
    "HubAssist is a full-stack monorepo platform for coworking and workspace management with web, API, and Soroban smart contracts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen py-3">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
