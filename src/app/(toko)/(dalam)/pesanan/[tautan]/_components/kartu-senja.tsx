"use client";

import { useEffect, useState } from "react";

import { warnaTeksLangit } from "../../../../_components/pelukis-pemandangan";
import { PemandanganSenja } from "../../../../_components/pemandangan-senja";
import { hitungMundur } from "./hitung-mundur";

/**
 * Kartu senja Halaman bayar (PRD §5.6, DESIGN.md "Pemandangan senja"): pemandangan senja 136 px (280 px
 * mulai 900 px) dengan radius 24 px, yang waktu senjanya digerakkan hitung mundur QRIS. Angka waktu dan
 * Total bayar ditulis di atas langit, dengan warna yang mengikuti luminans langit. Pembaca layar mendapat
 * sisa menit lewat aria-live, yang isinya hanya berganti sekali per menit. Saat waktu habis, labelnya
 * menjadi "QRIS kedaluwarsa".
 *
 * Hitung mundur dihitung dari waktu kedaluwarsa yang tersimpan di Pesanan terhadap jam browser. Tampilan
 * pertama memakai jam server saat halaman dibuat, supaya hasil SSR dan hidrasi sama; sesudahnya jam
 * browser dibaca setiap detik sampai waktunya habis.
 */
export function KartuSenja({
  kedaluwarsaPada,
  sekarang,
  totalBayar,
}: {
  /** Waktu kedaluwarsa QRIS dalam milidetik. */
  kedaluwarsaPada: number;
  /** Jam server saat halaman dibuat, dalam milidetik. */
  sekarang: number;
  /** Total bayar yang sudah ditulis sebagai rupiah. */
  totalBayar: string;
}) {
  const [kini, setKini] = useState(sekarang);
  const { teks, sisaMenit, habis, t } = hitungMundur({
    kedaluwarsaPada,
    sekarang: kini,
  });

  useEffect(() => {
    if (habis) return;
    const jam = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(jam);
  }, [habis]);

  return (
    <div>
      <div className="relative isolate h-[136px] overflow-hidden rounded-[24px] bg-langit shadow-bayang lebar:h-[280px]">
        <PemandanganSenja jenis="bayar" t={t} />
        <div
          className="absolute inset-x-4 top-4 flex items-start justify-between gap-3"
          style={{ color: warnaTeksLangit({ t }) }}
        >
          <div className="min-w-0">
            <p
              aria-hidden="true"
              className="text-4xl leading-none font-extrabold tracking-[-0.03em] lebar:text-5xl"
            >
              {teks}
            </p>
            <p className="text-[13px] font-bold">
              {habis ? "QRIS kedaluwarsa" : "sisa waktu bayar"}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[13px] font-bold">Total bayar</p>
            <p className="text-2xl font-extrabold tracking-[-0.02em]">
              {totalBayar}
            </p>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {habis ? "QRIS kedaluwarsa" : `Sisa waktu bayar ${sisaMenit} menit`}
      </p>
    </div>
  );
}
