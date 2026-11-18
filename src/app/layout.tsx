import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SKRIP_MODE_AWAL } from "./_mode/mode-tampilan";
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

// Script mode tampilan berjalan di <head> sebelum isi halaman dilukis, jadi halaman langsung tampil dengan
// mode pilihan (PRD §11.3). Script itu memasang data-mode pada <html> sebelum hidrasi, sehingga peringatan
// hidrasi untuk atribut <html> dimatikan.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={cn(manrope.variable, jetbrainsMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_MODE_AWAL }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
