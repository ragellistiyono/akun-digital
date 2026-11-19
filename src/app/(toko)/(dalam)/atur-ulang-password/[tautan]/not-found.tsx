import Link from "next/link";

// Halaman tidak ditemukan untuk Tautan atur ulang password yang tidak dikenal (PRD §7.5). Pesannya menyebut
// sebabnya dan langkah berikutnya. Tata letak Fokus (DESIGN.md Tata letak halaman): kolom 560 px di tengah,
// dengan tombol selebar kolom.
export default function TautanAturUlangTidakDitemukan() {
  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Tautan tidak ditemukan</h1>
      <p className="mt-2 text-pensil-redup">
        Tautan atur ulang password ini tidak dikenal. Periksa lagi alamatnya,
        atau minta tautan baru di halaman Lupa password.
      </p>
      <Link href="/lupa-password" className="tombol mt-6 w-full">
        Minta tautan baru
      </Link>
    </div>
  );
}
