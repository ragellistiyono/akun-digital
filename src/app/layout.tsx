import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./globals.css";

// Manrope dimuat sebagai font variabel, jadi satu berkas mencakup tebal 400–800.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "MIWE Digital Store",
};

// viewport-fit=cover membuat env(safe-area-inset-bottom) terisi di ponsel berponi.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={cn(manrope.variable, jetbrainsMono.variable)}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
