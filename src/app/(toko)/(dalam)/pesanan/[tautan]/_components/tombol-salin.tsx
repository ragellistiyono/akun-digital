"use client";

import { Check, Copy, CopyCheck, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Lama tombol Salin menampilkan "Tersalin" setelah diketuk (DESIGN.md "Blok Item stok dan tombol Salin"). */
const LAMA_TERSALIN_MS = 1_600;

/**
 * Tombol Salin satu kolom Item stok (PRD §6.1, DESIGN.md "Blok Item stok dan tombol Salin"): tombol kedua
 * 40 px (`tombol tombol-kedua tombol-kecil`). Setelah diketuk, isi kolom itu disalin ke clipboard, lalu tombol
 * menjadi "Tersalin" dengan ikon Check dan warna `st-selesai` selama 1,6 detik. Ketukan berikutnya memulai
 * 1,6 detik itu dari awal. Pembaca layar mendengar bahwa kolom itu tersalin. Bila browser menolak penyalinan,
 * tombol tetap "Salin".
 */
export function TombolSalin({ nama, nilai }: { nama: string; nilai: string }) {
  return (
    <TombolSalinTeks
      teks={nilai}
      ikon={Copy}
      label="Salin"
      labelTersalin="Tersalin"
      namaAksesibel={`Salin ${nama}`}
      pengumuman={`${nama} tersalin`}
    />
  );
}

/**
 * Tombol "Salin semua" di kepala kartu Item stok (PRD §6.1 ▶ Keputusan 2026-11-20, DESIGN.md "Blok Item stok
 * dan tombol Salin"): ikon CopyCheck dan label "Salin semua". Teks yang disalin dihitung modul domain
 * (teksSalinSemua). Umpan baliknya sama dengan tombol Salin per kolom, dengan label "Semua tersalin".
 */
export function TombolSalinSemua({ teks }: { teks: string }) {
  return (
    <TombolSalinTeks
      teks={teks}
      ikon={CopyCheck}
      label="Salin semua"
      labelTersalin="Semua tersalin"
      pengumuman="Semua kolom Item stok tersalin"
    />
  );
}

function TombolSalinTeks({
  teks,
  ikon,
  label,
  labelTersalin,
  namaAksesibel,
  pengumuman,
}: {
  teks: string;
  ikon: LucideIcon;
  label: string;
  labelTersalin: string;
  /** Nama tombol bagi pembaca layar, bila berbeda dari labelnya. */
  namaAksesibel?: string;
  pengumuman: string;
}) {
  // Berapa kali teks ini berhasil disalin sejak tombol terakhir kembali ke labelnya.
  const [salinan, setSalinan] = useState(0);
  const tersalin = salinan > 0;

  useEffect(() => {
    if (salinan === 0) return;
    const jam = setTimeout(() => setSalinan(0), LAMA_TERSALIN_MS);
    return () => clearTimeout(jam);
  }, [salinan]);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      // Clipboard tidak tersedia atau izinnya ditolak: tombol tidak berpura-pura sudah menyalin.
      return;
    }
    setSalinan((jumlah) => jumlah + 1);
  };

  const Ikon = tersalin ? Check : ikon;
  return (
    <>
      <button
        type="button"
        onClick={salin}
        aria-label={namaAksesibel}
        className={cn(
          "tombol tombol-kedua tombol-kecil shrink-0",
          // Warna "Tersalin" adalah utilitas, jadi tetap menang atas warna hover tombol kedua.
          tersalin && "bg-st-selesai-bg text-st-selesai",
        )}
      >
        <Ikon
          aria-hidden="true"
          strokeWidth={2.5}
          className="size-[18px] shrink-0"
        />
        {tersalin ? labelTersalin : label}
      </button>
      <span role="status" className="sr-only">
        {tersalin ? pengumuman : ""}
      </span>
    </>
  );
}
