import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Kalam, Patrick_Hand } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SKRIP_MODE_AWAL } from "./_mode/mode-tampilan";
import "./globals.css";
import { pengaturanIphone } from "./layar-pembuka-iphone";
import manifest from "./manifest.json";
import warnaBilahStatus from "./warna-bilah-status.json";

// Huruf coretan tangan (DESIGN.md Typography): Patrick Hand untuk isi, Kalam tebal untuk judul.
const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-patrick-hand",
});

const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-kalam",
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
// Pasang seperti aplikasi (PRD §11.4 ▶ Keputusan 2026-11-20): manifest.json di folder ini ditautkan Next.js
// ke semua halaman. Browser dan sistem ponsel tidak bisa membaca token CSS, jadi warna `kertas` ditulis
// sebagai nilai di manifest itu, dan warna bilah status Android ditulis di warna-bilah-status.json. Bilah
// status itu mengikuti mode perangkat, bukan pilihan mode di tab Akun: `kertas` di mode terang dan
// `kertas-gelap` di mode gelap. Ikon di public/ikon/ dibuat sekali dari docs/input/logo.png; ikon maskable
// memuat logo selebar 80% di tengah latar `kertas`, supaya huruf MDS tidak terpotong di ponsel yang memotong
// ikon bulat.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: warnaBilahStatus.terang },
    { media: "(prefers-color-scheme: dark)", color: warnaBilahStatus.gelap },
  ],
};

// Script mode tampilan berjalan di <head> sebelum isi halaman dilukis, jadi halaman langsung tampil dengan
// mode pilihan (PRD §11.3). Script itu memasang data-mode pada <html> sebelum hidrasi, sehingga peringatan
// hidrasi untuk atribut <html> dimatikan.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={cn(
        patrickHand.variable,
        kalam.variable,
        jetbrainsMono.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_MODE_AWAL }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
