"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Baris tabel yang membuka alamat itu saat diketuk di mana saja (PRD §14.8). Tautan di dalam baris, yaitu Nomor
 * Pesanan, tetap menjadi jalan untuk papan ketik dan pembaca layar, jadi ketukan pada tautan itu dibiarkan
 * ditangani tautannya sendiri.
 */
export function BarisTautan({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className={className}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest("a")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
