"use client";

import { useActionState, type ReactNode } from "react";

import { BilahLekat } from "../../../../_components/bilah-lekat";
import { PesanGalat } from "../../../../_components/pesan-galat";
import type { KeadaanPembatalan } from "../aksi";

/**
 * Tombol kedua (DESIGN.md Buttons, `tombol tombol-kedua`). Di bilah lekat lebarnya mengikuti isinya dengan
 * padding samping 16 px, seperti prototipe Halaman bayar, sehingga tombol utama di sampingnya mengisi sisa
 * bilah. Di layar sempit hurufnya 18 px, sama dengan tombol di sampingnya, supaya keduanya muat di lebar 360 px.
 */
const KELAS_TOMBOL_BATALKAN =
  "tombol tombol-kedua flex-none! px-4 disabled:cursor-wait max-[399px]:text-lg";

/**
 * Bilah lekat Halaman bayar (PRD §5.6, §5.8, §15.3): tombol kedua "Batalkan" di samping aksi utama yang diberikan
 * halaman, yaitu "Simpan gambar QR". Menekan "Batalkan" menjalankan `aksiBatalkan` dengan `isian` tersembunyi yang
 * menunjuk tagihannya, yaitu Tautan Pesanan atau Nomor Top up; selama diproses tombolnya nonaktif. Bila
 * pembatalannya gagal, pesan galatnya tampil di bilah lekat, tepat di atas tombolnya.
 */
export function FormBatalkan({
  aksiBatalkan,
  isian,
  children,
}: {
  aksiBatalkan: (
    sebelumnya: KeadaanPembatalan,
    formData: FormData,
  ) => Promise<KeadaanPembatalan>;
  isian: { nama: string; nilai: string };
  children: ReactNode;
}) {
  const [keadaan, aksi, sedangMemproses] = useActionState<
    KeadaanPembatalan,
    FormData
  >(aksiBatalkan, {});

  return (
    // Form ini tidak membuat kotak sendiri, sehingga bilah lekat tetap tersusun di kolom Halaman bayar.
    <form action={aksi} className="contents">
      <input type="hidden" name={isian.nama} value={isian.nilai} />
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
