import Link from "next/link";

// Halaman tidak ditemukan untuk Tautan Pesanan yang tidak dikenal (PRD §6.2). Pesannya menyebut sebabnya
// dan langkah berikutnya. Pola Fokus (DESIGN.md "Tata letak halaman"): kolom 560 px di tengah, dengan
// tombol utama selebar kolom.
export default function PesananTidakDitemukan() {
  return (
    <div className="tata-fokus mt-4">
      <h1>Pesanan tidak ditemukan</h1>
      <p className="mt-4 text-pensil-redup">
        Tautan Pesanan ini tidak dikenal. Periksa lagi alamatnya, atau lihat
        Produk di Beranda.
      </p>
      <Link href="/" className="tombol mt-6 flex w-full">
        Lihat Beranda
      </Link>
    </div>
  );
}
