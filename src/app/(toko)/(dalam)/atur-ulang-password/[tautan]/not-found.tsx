import Link from "next/link";

import { KELAS_TOMBOL_UTAMA } from "../../../_components/bilah-lekat";

// Halaman tidak ditemukan untuk Tautan atur ulang password yang tidak dikenal (PRD §7.5). Pesannya menyebut
// sebabnya dan langkah berikutnya.
export default function TautanAturUlangTidakDitemukan() {
  return (
    <>
      <h1 className="mt-4">Tautan tidak ditemukan</h1>
      <p className="mt-4 max-w-[65ch] text-tinta-redup">
        Tautan atur ulang password ini tidak dikenal. Periksa lagi alamatnya,
        atau minta tautan baru di halaman Lupa password.
      </p>
      <Link href="/lupa-password" className={`mt-6 ${KELAS_TOMBOL_UTAMA}`}>
        Minta tautan baru
      </Link>
    </>
  );
}
