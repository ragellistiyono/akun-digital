import Link from "next/link";

import { FormDaftar } from "./_components/form-daftar";

// Halaman Daftar Member tanpa membeli (PRD §7.2), dibuka dari tombol Daftar di tab Akun dan tab Riwayat
// serta dari halaman Masuk (T51), dan menaut balik ke halaman Masuk.
export default function HalamanDaftar() {
  return (
    <div className="max-w-[440px]">
      <h1 className="mt-4">Daftar</h1>
      <p className="mt-2 text-tinta-redup">
        Buat password untuk akun Member Anda. Kami kirim Kode verifikasi ke
        email itu.
      </p>
      <FormDaftar />
      <p className="mt-4 text-sm font-bold">
        Sudah punya akun?{" "}
        <Link
          href="/masuk"
          className="text-aksi-teks underline decoration-[1.5px] underline-offset-4"
        >
          Masuk
        </Link>
      </p>
    </div>
  );
}
