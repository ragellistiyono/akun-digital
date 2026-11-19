import Link from "next/link";

import { FormDaftar } from "./_components/form-daftar";

// Halaman Daftar Member tanpa membeli (PRD §7.2), dibuka dari tombol Daftar di tab Akun dan tab Riwayat
// serta dari halaman Masuk (T51), dan menaut balik ke halaman Masuk. Tata letak Fokus (DESIGN.md Tata letak
// halaman): kolom 560 px di tengah, dengan catatan post-it rata tengah di bawah form.
export default function HalamanDaftar() {
  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Daftar</h1>
      <p className="mt-2 text-pensil-redup">
        Buat password untuk akun Member Anda. Kami kirim Kode verifikasi ke
        email itu.
      </p>
      <FormDaftar />
      {/* Catatan post-it: tautan di atas post-it memakai `teks-postit`, karena biru pulpen tidak terbaca di
          post-it mode gelap. */}
      <p className="kartu kartu-postit mx-auto mt-6 w-fit rotate-1 px-4 py-2 text-[17px]">
        Sudah punya akun?{" "}
        <Link
          href="/masuk"
          className="underline decoration-2 underline-offset-4"
        >
          Masuk
        </Link>
      </p>
    </div>
  );
}
