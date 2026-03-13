import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PoolSightAI",
  description: "Executive deck, roadmap, and live demo",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}

