"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Lama tombol Salin menampilkan "Tersalin" setelah diketuk (DESIGN.md "Blok Item stok dan tombol Salin"). */
const LAMA_TERSALIN_MS = 1_600;

/**
 * Tombol Salin satu kolom Item stok (PRD §6.1, DESIGN.md "Blok Item stok dan tombol Salin"): tombol 40 px
 * berlatar `langit-2` dengan garis `langit-garis` dan garis `monogram` saat hover. Setelah diketuk, isi
 * kolom itu disalin ke clipboard, lalu tombol menjadi "Tersalin" dengan ikon Check dan warna `st-selesai`
 * selama 1,6 detik. Ketukan berikutnya memulai 1,6 detik itu dari awal. Pembaca layar mendengar bahwa
 * kolom itu tersalin. Bila browser menolak penyalinan, tombol tetap "Salin".
 */
export function TombolSalin({ nama, nilai }: { nama: string; nilai: string }) {
  // Berapa kali kolom ini berhasil disalin sejak tombol terakhir kembali menjadi "Salin".
  const [salinan, setSalinan] = useState(0);
  const tersalin = salinan > 0;

  useEffect(() => {
    if (salinan === 0) return;
    const jam = setTimeout(() => setSalinan(0), LAMA_TERSALIN_MS);
    return () => clearTimeout(jam);
  }, [salinan]);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(nilai);
    } catch {
      // Clipboard tidak tersedia atau izinnya ditolak: tombol tidak berpura-pura sudah menyalin.
      return;
    }
    setSalinan((jumlah) => jumlah + 1);
  };

  const Ikon = tersalin ? Check : Copy;
  return (
    <>
      <button
        type="button"
        onClick={salin}
        aria-label={`Salin ${nama}`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] border-[1.5px] px-3 text-sm font-extrabold",
          tersalin
            ? "border-transparent bg-st-selesai-bg text-st-selesai"
            : "border-langit-garis bg-langit-2 text-langit-teks hover:border-monogram",
        )}
      >
        <Ikon aria-hidden="true" className="size-[18px] shrink-0" />
        {tersalin ? "Tersalin" : "Salin"}
      </button>
      <span role="status" className="sr-only">
        {tersalin ? `${nama} tersalin` : ""}
      </span>
    </>
  );
}
