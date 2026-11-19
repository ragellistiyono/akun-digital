"use client";

import { useEffect, useRef, useState } from "react";

import type { Kotak } from "../../../../_components/pelukis-pemandangan";
import { PemandanganSenja } from "../../../../_components/pemandangan-senja";
import { hitungMundur } from "./hitung-mundur";

/**
 * Kartu senja Halaman bayar (PRD §5.6): kartu coretan 136 px (280 px mulai 900 px) berisi pemandangan
 * gunung yang waktu senjanya digerakkan hitung mundur QRIS. Matahari turun dari atas sampai tenggelam di
 * balik punggung gunung saat waktu habis, arsiran langit bertambah, lalu bintang muncul. Angka waktu dan
 * Total bayar ditulis dengan pensil di atas kertas kartu. Kotak kedua blok teks itu diukur dan dikirim ke
 * pemandangan, yang menjauhkan matahari, bintang, awan, dan arsiran langit dari teks. Pembaca layar
 * mendapat sisa menit lewat aria-live, yang isinya hanya berganti sekali per menit. Saat waktu habis,
 * labelnya menjadi "QRIS kedaluwarsa".
 *
 * Angka waktu selebar paling sedikit lima karakter, supaya kotaknya tidak berubah setiap detik.
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
  // kedaluwarsa" atau huruf tulisan tangan selesai dimuat. Kotaknya diukur dari tepi dalam garis kartu,
  // tempat pemandangan dilukis.
  useEffect(() => {
    const semua = [kartu.current, blokWaktu.current, blokTotal.current];
    const [wadah, ...blok] = semua;
    if (!wadah || blok.some((b) => !b)) return;
    const ukur = () => {
      const dasar = wadah.getBoundingClientRect();
      const kiri = dasar.left + wadah.clientLeft;
      const atas = dasar.top + wadah.clientTop;
      const kotak = blok.map((b) => {
        const k = b!.getBoundingClientRect();
        return {
          x: k.left - kiri,
          y: k.top - atas,
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
        className="kartu kartu-tegas relative isolate h-[136px] overflow-hidden lebar:h-[280px]"
      >
        <PemandanganSenja jenis="bayar" t={t} teks={kotakTeks}>
          {(warnaTeks) => (
            <div
              className="absolute inset-x-4 top-2.5 flex items-start justify-between gap-3"
              style={{ color: warnaTeks }}
            >
              <div ref={blokWaktu} className="min-w-0">
                <p className="text-[15px] leading-none lebar:text-base">
                  {habis ? "QRIS kedaluwarsa" : "sisa waktu bayar"}
                </p>
                <p
                  aria-hidden="true"
                  className="mt-1 min-w-[5ch] font-spidol text-[40px] leading-none font-bold tabular-nums lebar:text-[56px]"
                >
                  {teks}
                </p>
              </div>
              <div ref={blokTotal} className="min-w-0 text-right">
                <p className="text-[15px] leading-none lebar:text-base">
                  Total bayar
                </p>
                <p className="mt-1 font-spidol text-[22px] leading-none font-bold tabular-nums">
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
