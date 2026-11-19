import Link from "next/link";

// Halaman tidak ditemukan untuk checkout Varian yang tidak ada atau tidak bisa dibeli, misalnya Varian
// atau Produk nonaktif (PRD §3.7). Pesannya menyebut sebabnya dan langkah berikutnya. Pola Fokus (DESIGN.md
// "Tata letak halaman"): kolom 560 px di tengah, dengan tombol utama selebar kolom.
export default function CheckoutTidakDitemukan() {
  return (
    <div className="tata-fokus mt-4">
      <h1>Varian tidak ditemukan</h1>
      <p className="mt-4 text-pensil-redup">
        Varian ini tidak ada atau sedang tidak dijual. Lihat Produk lain di
        Beranda.
      </p>
      <Link href="/" className="tombol mt-6 flex w-full">
        Lihat Beranda
      </Link>
    </div>
  );
}
