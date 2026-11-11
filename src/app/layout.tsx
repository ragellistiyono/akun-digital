import type { Metadata } from "next";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./globals.css";

export const metadata: Metadata = {
  title: "MIWE Digital Store",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className={cn("min-h-dvh antialiased")}>{children}</body>
    </html>
  );
}
