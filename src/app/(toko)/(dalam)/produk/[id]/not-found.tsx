import Link from "next/link";

// Halaman tidak ditemukan untuk Produk yang tidak ada atau tidak tampil di toko, misalnya Produk nonaktif
// (PRD §3.7). Pesannya menyebut sebabnya dan langkah berikutnya.
export default function ProdukTidakDitemukan() {
  return (
    <>
      <h1 className="mt-4">Produk tidak ditemukan</h1>
      <p className="mt-4 max-w-[65ch] text-tinta-redup">
        Produk ini tidak ada atau sedang tidak dijual. Lihat Produk lain di
        Beranda.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-aksi px-6 text-base font-extrabold text-teks-di-aksi transition-[background-color,scale] duration-150 hover:bg-aksi-tekan active:scale-[0.98] motion-reduce:transition-none"
      >
        Lihat Beranda
      </Link>
    </>
  );
}
