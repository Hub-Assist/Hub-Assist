import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hubassist Landing",
  description:
    "HubAssist is a full-stack monorepo platform for coworking and workspace management with web, API, and Soroban smart contracts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen py-3">{children}</body>
    </html>
  );
}
