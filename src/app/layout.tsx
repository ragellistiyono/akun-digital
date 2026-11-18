import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SKRIP_MODE_AWAL } from "./_mode/mode-tampilan";
import "./globals.css";
import { pengaturanIphone } from "./layar-pembuka-iphone";
import manifest from "./manifest.json";

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
  icons: {
    apple: { url: "/ikon/apple-touch-icon.png", sizes: "180x180" },
  },
  // Judul di bawah ikon layar utama iPhone sama dengan nama pendek di manifest (PRD §11.4).
  ...pengaturanIphone(manifest.short_name),
};

// viewport-fit=cover membuat env(safe-area-inset-bottom) terisi di ponsel berponi.
//
// Pasang seperti aplikasi (PRD §11.4 ▶ Keputusan 2026-11-18): manifest.json di folder ini ditautkan Next.js
// ke semua halaman. Browser dan sistem ponsel tidak bisa membaca token CSS, jadi warna `langit` ditulis
// sebagai nilai di manifest itu, dan bilah status ponsel mengambil warna yang sama dari sana, di mode terang
// maupun gelap. Ikon di public/ikon/ dibuat sekali dari docs/input/logo.png; ikon maskable memuat logo
// selebar 80% di tengah latar `langit`, supaya huruf MDS tidak terpotong di ponsel yang memotong ikon bulat.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: manifest.theme_color,
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
