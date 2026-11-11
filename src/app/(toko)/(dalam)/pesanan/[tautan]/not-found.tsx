import Link from "next/link";

import { KELAS_TOMBOL_UTAMA } from "../../../_components/bilah-lekat";

// Halaman tidak ditemukan untuk Tautan Pesanan yang tidak dikenal (PRD §6.2). Pesannya menyebut sebabnya
// dan langkah berikutnya.
export default function PesananTidakDitemukan() {
  return (
    <>
      <h1 className="mt-4">Pesanan tidak ditemukan</h1>
      <p className="mt-4 max-w-[65ch] text-tinta-redup">
        Tautan Pesanan ini tidak dikenal. Periksa lagi alamatnya, atau lihat
        Produk di Beranda.
      </p>
      <Link href="/" className={`mt-6 ${KELAS_TOMBOL_UTAMA}`}>
        Lihat Beranda
      </Link>
    </>
  );
}
