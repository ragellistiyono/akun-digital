"use client";

import { useId, useState, type PointerEvent } from "react";

import { angkaRupiah, rupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";

// Grafik batang mendatar Laporan keuangan (PRD §14.7 grafik 4 dan 5), mengikuti DESIGN.md "Grafik Laporan
// keuangan": nama di kiri, batang SVG lurus di tengah, lalu jumlah Pesanan Selesai dan Pendapatan rata kanan dalam
// huruf isi, dengan batang terpanjang mengisi lebar yang tersedia. Di layar sempit, nama dan angkanya berada di atas
// batangnya, supaya halaman tidak bergulir ke samping (PRD §11.1). Mengetuk, menyorot, atau memfokus sebuah baris
// memunculkan catatan nilai bergaya Toast, dan tabel tersembunyi memuat semua nilai untuk pembaca layar. Semua
// warna berupa token, jadi mode gelap ikut sendiri.

/** Satu baris grafik: nama, jumlah Pesanan Selesai, dan Pendapatan-nya. */
type Baris = {
  kunci: string;
  nama: string;
  pesananSelesai: number;
  pendapatan: number;
};

/** Teks jumlah Pesanan Selesai, misalnya "5 Pesanan". */
const teksPesanan = (jumlah: number) => `${angkaRupiah(jumlah)} Pesanan`;

/**
 * Grafik batang mendatar. `batang` menentukan nilai yang digambar sebagai panjang batang: jumlah Pesanan Selesai
 * (Produk terlaris) atau Pendapatan (Pendapatan per Kategori). Barisnya ditampilkan dengan urutan yang diberikan.
 */
export function GrafikBatangMendatar({
  judul,
  batang,
  baris,
}: {
  judul: string;
  batang: "pesananSelesai" | "pendapatan";
  baris: Baris[];
}) {
  const idJudul = useId();
  const [aktif, setAktif] = useState<number | null>(null);
  const terbesar = Math.max(0, ...baris.map((b) => b[batang]));
  const namaSeri =
    batang === "pesananSelesai" ? "Pesanan Selesai" : "Pendapatan";
  const catatan = (b: Baris) =>
    `${b.nama} · ${teksPesanan(b.pesananSelesai)} · ${rupiah(b.pendapatan)}`;

  return (
    <figure aria-labelledby={idJudul} className="kartu min-w-0 p-4 sm:p-6">
      <h3 id={idJudul} className="text-[24px] leading-[1.2]">
        {judul}
      </h3>
      <p className="mt-2 flex items-center gap-2 text-[15px] text-pensil-redup">
        <svg aria-hidden="true" width="28" height="14" className="shrink-0">
          <rect
            x="1"
            y="1"
            width="26"
            height="12"
            strokeWidth="2"
            className="fill-pulpen stroke-pensil"
          />
        </svg>
        {namaSeri}
      </p>

      {baris.length === 0 ? (
        <p className="mt-4 max-w-[65ch] text-pensil-redup">
          Belum ada Pesanan Selesai dalam rentang ini.
        </p>
      ) : (
        <>
          {/* Catatan nilai bergaya Toast: latar post-it, garis 2 px pensil, tanpa rotasi. Barisnya selalu
              disediakan, supaya grafik tidak bergeser saat catatan muncul. */}
          <div role="status" aria-live="polite" className="mt-3 min-h-10">
            {aktif !== null && baris[aktif] !== undefined && (
              <p className="inline-block max-w-full rounded-coret border-2 border-pensil bg-postit px-3 py-1 text-[15px] text-teks-postit tabular-nums [overflow-wrap:anywhere]">
                {catatan(baris[aktif])}
              </p>
            )}
          </div>

          <ol
            aria-label={`Grafik ${judul}`}
            className="mt-2 flex flex-col gap-1"
          >
            {baris.map((b, i) => {
              const nilai = b[batang];
              const panjang = terbesar > 0 ? (nilai / terbesar) * 100 : 0;
              return (
                <li key={b.kunci}>
                  <button
                    type="button"
                    aria-label={catatan(b)}
                    onPointerEnter={() => setAktif(i)}
                    onPointerLeave={(e: PointerEvent) => {
                      // Di layar sentuh, pointerleave datang tepat sesudah ketukan, jadi catatan hanya ditutup
                      // untuk tetikus.
                      if (e.pointerType === "mouse") setAktif(null);
                    }}
                    onClick={() => setAktif(i)}
                    onFocus={() => setAktif(i)}
                    onBlur={() => setAktif(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAktif(null);
                    }}
                    className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-coret py-1.5 text-left text-[17px] leading-tight sm:grid-cols-[minmax(6rem,12rem)_minmax(0,1fr)_auto]"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {b.nama}
                    </span>
                    {/* Batang lurus: isian pulpen, garis tepi 2 px pensil, sudut lurus. Batang bernilai 0 tidak
                        digambar. Di layar sempit batang menempati baris keduanya sendiri. */}
                    <svg
                      aria-hidden="true"
                      width="100%"
                      height="24"
                      viewBox="0 0 100 24"
                      preserveAspectRatio="none"
                      overflow="visible"
                      className="order-last col-span-2 block px-px sm:order-none sm:col-span-1"
                    >
                      {nilai > 0 && (
                        <rect
                          x={0}
                          y={1}
                          width={panjang}
                          height={22}
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                          className={cn(
                            "stroke-pensil",
                            aktif === i ? "fill-postit" : "fill-pulpen",
                          )}
                        />
                      )}
                    </svg>
                    <span className="text-right whitespace-nowrap tabular-nums">
                      {teksPesanan(b.pesananSelesai)} · {rupiah(b.pendapatan)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {/* Ringkasan untuk pembaca layar: semua baris dan nilainya. Tabelnya dibungkus elemen sr-only, karena tabel
          melebar mengikuti isinya walau diberi lebar 1 px, dan nama panjang membuat halaman bergulir ke samping. */}
      <div className="sr-only">
        <table>
          <caption>Nilai grafik {judul}</caption>
          <thead>
            <tr>
              <th scope="col">Nama</th>
              <th scope="col">Pesanan Selesai</th>
              <th scope="col">Pendapatan</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.kunci}>
                <th scope="row">{b.nama}</th>
                <td>{angkaRupiah(b.pesananSelesai)}</td>
                <td>{rupiah(b.pendapatan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
