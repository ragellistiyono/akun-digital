"use client";

import { useEffect, useRef, useState } from "react";

import type { Kotak } from "../../../../_components/pelukis-pemandangan";
import { PemandanganSenja } from "../../../../_components/pemandangan-senja";
import { hitungMundur } from "./hitung-mundur";

/**
 * Kartu senja Halaman bayar (PRD §5.6, DESIGN.md "Pemandangan senja"): pemandangan senja 136 px (280 px
 * mulai 900 px) dengan radius 24 px, yang waktu senjanya digerakkan hitung mundur QRIS. Angka waktu dan
 * Total bayar ditulis di atas langit. Kotak kedua blok teks itu diukur dan dikirim ke pemandangan, yang
 * menjauhkan matahari, cahaya ufuk, awan, dan bintang dari teks, lalu memilih warna teks gelap atau
 * putih terhadap latar di belakangnya. Pembaca layar mendapat sisa menit lewat aria-live, yang isinya
 * hanya berganti sekali per menit. Saat waktu habis, labelnya menjadi "QRIS kedaluwarsa".
 *
 * Teks dimulai 8 px dari tepi atas, dan label ditulis di atas angka waktu karena angka tidak punya kaki
 * huruf. Dengan begitu semua teks tetap di bagian langit yang cukup gelap untuk kontras 4,5:1 sejak awal
 * hitung mundur, saat langit di bawah 42% tinggi kartu masih terang.
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
  const kartu = useRef<HTMLDivElement>(null);
  const blokWaktu = useRef<HTMLDivElement>(null);
  const blokTotal = useRef<HTMLDivElement>(null);
  const [kotakTeks, setKotakTeks] = useState<Kotak[] | null>(null);

  useEffect(() => {
    if (habis) return;
    const jam = setInterval(() => setKini(Date.now()), 1000);
    return () => clearInterval(jam);
  }, [habis]);

  // Kotak blok teks diukur ulang saat ukuran kartu atau isi blok berubah, misalnya label menjadi "QRIS
  // kedaluwarsa" atau huruf Manrope selesai dimuat.
  useEffect(() => {
    const semua = [kartu.current, blokWaktu.current, blokTotal.current];
    const [wadah, ...blok] = semua;
    if (!wadah || blok.some((b) => !b)) return;
    const ukur = () => {
      const dasar = wadah.getBoundingClientRect();
      const kotak = blok.map((b) => {
        const k = b!.getBoundingClientRect();
        return {
          x: k.left - dasar.left,
          y: k.top - dasar.top,
          lebar: k.width,
          tinggi: k.height,
        };
      });
      setKotakTeks((lama) =>
        JSON.stringify(lama) === JSON.stringify(kotak) ? lama : kotak,
      );
    };
    const pengamat = new ResizeObserver(ukur);
    for (const el of semua) pengamat.observe(el!);
    return () => pengamat.disconnect();
  }, []);

  return (
    <div>
      <div
        ref={kartu}
        className="relative isolate h-[136px] overflow-hidden rounded-[24px] bg-langit shadow-bayang lebar:h-[280px]"
      >
        <PemandanganSenja jenis="bayar" t={t} teks={kotakTeks}>
          {(warnaTeks) => (
            <div
              className="absolute inset-x-4 top-2 flex items-start justify-between gap-3"
              style={{ color: warnaTeks }}
            >
              <div ref={blokWaktu} className="min-w-0">
                <p className="text-[13px] leading-none font-bold">
                  {habis ? "QRIS kedaluwarsa" : "sisa waktu bayar"}
                </p>
                <p
                  aria-hidden="true"
                  className="text-4xl leading-none font-extrabold tracking-[-0.03em] lebar:text-5xl"
                >
                  {teks}
                </p>
              </div>
              <div ref={blokTotal} className="min-w-0 text-right">
                <p className="text-[13px] leading-none font-bold">
                  Total bayar
                </p>
                <p className="text-xl leading-none font-extrabold tracking-[-0.02em]">
                  {totalBayar}
                </p>
              </div>
            </div>
          )}
        </PemandanganSenja>
      </div>
      <p aria-live="polite" className="sr-only">
        {habis ? "QRIS kedaluwarsa" : `Sisa waktu bayar ${sisaMenit} menit`}
      </p>
    </div>
  );
}
