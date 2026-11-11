"use client";

import { useActionState, type ReactNode } from "react";

import { BilahLekat } from "../../../../_components/bilah-lekat";
import { PesanGalat } from "../../../../_components/pesan-galat";
import { aksiBatalkanPesanan, type KeadaanPembatalan } from "../aksi";

/**
 * Tombol garis (DESIGN.md Buttons): latar `permukaan`, garis 1,5 px `garis` yang menjadi `monogram` saat
 * hover, dan mengecil ke 0,98 saat ditekan. Di bilah lekat lebarnya mengikuti isinya dengan padding
 * samping 16 px, seperti prototipe Halaman bayar, sehingga tombol utama di sampingnya mengisi sisa bilah.
 */
const KELAS_TOMBOL_BATALKAN =
  "inline-flex h-[52px] flex-none! items-center justify-center rounded-[14px] border-[1.5px] border-garis bg-permukaan px-4 text-base font-extrabold text-tinta transition-[border-color,scale] duration-150 hover:border-monogram active:scale-[0.98] disabled:cursor-wait disabled:text-tinta-redup disabled:hover:border-garis disabled:active:scale-100 motion-reduce:transition-none";

/**
 * Bilah lekat Halaman bayar (PRD §5.6, §5.8): tombol garis "Batalkan" di samping aksi utama yang diberikan
 * halaman, yaitu "Simpan gambar QR". Menekan "Batalkan" membatalkan Pesanan di Tautan Pesanan itu; selama
 * diproses tombolnya nonaktif. Bila pembatalannya gagal, pesan galatnya tampil di bilah lekat, tepat di
 * atas tombolnya.
 */
export function FormBatalkan({
  tautan,
  children,
}: {
  tautan: string;
  children: ReactNode;
}) {
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanPembatalan,
    FormData
  >(aksiBatalkanPesanan, {});

  return (
    // Form ini tidak membuat kotak sendiri, sehingga bilah lekat tetap tersusun di kolom Halaman bayar.
    <form action={aksi} className="contents">
      <input type="hidden" name="tautan" value={tautan} />
      <BilahLekat pesan={keadaan.galat && <PesanGalat pesan={keadaan.galat} />}>
        <button
          type="submit"
          disabled={sedangMemproses}
          className={KELAS_TOMBOL_BATALKAN}
        >
          Batalkan
        </button>
        {children}
      </BilahLekat>
    </form>
  );
}
