import { Download } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { KartuSenja } from "./kartu-senja";

// Kerangka Halaman bayar (PRD §5.6), dipakai Halaman bayar Pesanan dan Halaman bayar Top up (PRD §15.3): kartu senja
// dengan hitung mundur QRIS dan Total bayar, gambar QR, lalu ringkasan tagihan yang diberikan halaman pemasangnya.
// Gambar QR adalah benda utama halaman ini, jadi ia tampil besar di tengah kartunya (DESIGN.md "Tata letak halaman",
// Halaman bayar): 240 px di ponsel dan 288 px di layar lebar. Di layar lebar halaman menjadi dua kolom: kartu QR lekat
// di kiri, lalu kartu senja dan ringkasan bertumpuk di kanan. Urutan isinya di halaman tetap kartu senja, QR, lalu
// ringkasan, jadi di ponsel dan bagi pembaca layar urutannya sama.
export function KerangkaHalamanBayar({
  kedaluwarsaPada,
  dibacaPada,
  totalBayar,
  gambarQr,
  altQr,
  pemantau,
  children,
}: {
  kedaluwarsaPada: Date;
  /** Jam server saat tagihan dibaca, titik awal hitung mundur. */
  dibacaPada: Date;
  /** Total bayar yang sudah ditulis sebagai rupiah. */
  totalBayar: string;
  /** Gambar QR sebagai data URL PNG. */
  gambarQr: string;
  altQr: string;
  /** Pemantau status yang tidak menampilkan apa pun, misalnya PantauStatusPesanan. */
  pemantau?: ReactNode;
  /** Ringkasan tagihan di kolom kanan: panel, rincian, dan bilah lekat. */
  children: ReactNode;
}) {
  return (
    <>
      <h1 className="mt-4">Pembayaran</h1>
      <div className="mt-6 grid items-start gap-8 lebar:grid-cols-2 lebar:gap-x-12 lebar:gap-y-6 lebar:[grid-template-areas:'qr_senja'_'qr_ringkasan']">
        <div className="min-w-0 lebar:[grid-area:senja]">
          <KartuSenja
            kedaluwarsaPada={kedaluwarsaPada.getTime()}
            sekarang={dibacaPada.getTime()}
            totalBayar={totalBayar}
          />
        </div>

        {/* Kartu QR berselotip, selebar kolom, dengan QR di tengahnya. Gambar QR-nya sendiri tidak diberi tepi
            coretan maupun diputar, dan selalu duduk di alas putih, juga di mode gelap, supaya pola dan zona
            tenangnya tetap terbaca pemindai. Jarak 32 px di ponsel memberi ruang bagi selotip yang menonjol
            12 px di atas kartu. Di layar lebar kartu ini lekat di bawah bilah atas, sejajar dengan kartu senja,
            jadi QR tetap terlihat saat ringkasan di kanan digulir. */}
        <div className="min-w-0 lebar:sticky lebar:top-24 lebar:[grid-area:qr]">
          <div className="kartu kartu-tegas selotip relative flex items-center justify-center p-6 lebar:p-8">
            <div className="bg-white p-3">
              <Image
                unoptimized
                src={gambarQr}
                alt={altQr}
                width={288}
                height={288}
                className="block aspect-square w-60 max-w-full [image-rendering:pixelated] lebar:w-72"
              />
            </div>
          </div>
          {pemantau}
        </div>

        {/* Ringkasan: antarpanel 16 px, dan tombolnya 24 px di bawah rincian (bilah lekat menjadi blok biasa dengan
            jarak atas 24 px di layar lebar). */}
        <div className="min-w-0 lebar:[grid-area:ringkasan]">{children}</div>
      </div>
    </>
  );
}

/**
 * Tombol "Simpan gambar QR" (PRD §5.6): gambar QR diunduh sebagai PNG, supaya Pembeli di ponsel bisa membukanya dari
 * aplikasi e-wallet.
 */
export function TombolSimpanQr({
  gambarQr,
  namaBerkas,
}: {
  gambarQr: string;
  namaBerkas: string;
}) {
  return (
    <a
      href={gambarQr}
      download={namaBerkas}
      // Padding samping 16 px dan, di layar sempit, huruf 18 px, supaya "Batalkan" dan tombol ini muat
      // berdampingan di lebar 360 px tanpa terpotong.
      className="tombol px-4 whitespace-nowrap max-[399px]:text-lg"
    >
      <Download
        aria-hidden="true"
        strokeWidth={2.5}
        className="size-5 shrink-0"
      />
      Simpan gambar QR
    </a>
  );
}
