import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Tombol "Masuk" (tombol utama) dan "Daftar" (tombol kedua) untuk Tamu, bertumpuk dengan celah 12 px
 * supaya bayangan 4 px tombol atas tidak menempel ke tombol bawah. Dipasang di tab Akun dan tab Riwayat
 * (PRD §11.1 ▶ Keputusan 2026-11-17).
 */
export function TombolMasukDaftar({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      <Link href="/masuk" className="tombol">
        Masuk
      </Link>
      <Link href="/daftar" className="tombol tombol-kedua">
        Daftar
      </Link>
    </div>
  );
}
