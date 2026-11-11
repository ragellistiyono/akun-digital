import Link from "next/link";

import { KELAS_TOMBOL_UTAMA } from "../../_components/bilah-lekat";

// Halaman tidak ditemukan untuk checkout Varian yang tidak ada atau tidak bisa dibeli, misalnya Varian
// atau Produk nonaktif (PRD §3.7). Pesannya menyebut sebabnya dan langkah berikutnya.
export default function CheckoutTidakDitemukan() {
  return (
    <>
      <h1 className="mt-4">Varian tidak ditemukan</h1>
      <p className="mt-4 max-w-[65ch] text-tinta-redup">
        Varian ini tidak ada atau sedang tidak dijual. Lihat Produk lain di
        Beranda.
      </p>
      <Link href="/" className={`mt-6 ${KELAS_TOMBOL_UTAMA}`}>
        Lihat Beranda
      </Link>
    </>
  );
}
