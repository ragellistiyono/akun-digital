import { FormDaftar } from "./_components/form-daftar";

// Halaman Daftar Member tanpa membeli (PRD §7.2). Belum ditautkan dari halaman toko mana pun: tautan
// ke halaman ini baru dipasang di T51 (PRD §13 ▶ Keputusan 2026-11-17).
export default function HalamanDaftar() {
  return (
    <div className="max-w-[440px]">
      <h1 className="mt-4">Daftar</h1>
      <p className="mt-2 text-tinta-redup">
        Buat password untuk akun Member Anda. Kami kirim Kode verifikasi ke
        email itu.
      </p>
      <FormDaftar />
    </div>
  );
}
