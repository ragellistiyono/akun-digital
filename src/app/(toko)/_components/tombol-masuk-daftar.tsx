import Link from "next/link";

import { cn } from "@/lib/utils";

const KELAS_TOMBOL =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] px-6 text-base font-extrabold";

/**
 * Tombol "Masuk" (tombol utama) dan "Daftar" (tombol garis) untuk Tamu, bertumpuk dengan celah 8 px seperti
 * prototipe DESIGN.md. Dipasang di tab Akun dan tab Riwayat (PRD §11.1 ▶ Keputusan 2026-11-17).
 */
export function TombolMasukDaftar({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Link
        href="/masuk"
        className={cn(
          KELAS_TOMBOL,
          "bg-aksi text-teks-di-aksi hover:bg-aksi-tekan active:scale-[0.98]",
        )}
      >
        Masuk
      </Link>
      <Link
        href="/daftar"
        className={cn(
          KELAS_TOMBOL,
          "border-[1.5px] border-garis bg-permukaan text-tinta hover:border-monogram",
        )}
      >
        Daftar
      </Link>
    </div>
  );
}
