import { FormLupaPassword } from "./_components/form-lupa-password";

// Halaman Lupa password (PRD §7.5 ▶ Keputusan 2026-11-17), ditautkan dari halaman Masuk Member. Member
// mengisi email, lalu Tautan atur ulang password dikirim ke email itu bila emailnya milik Member aktif.
// Tata letak Fokus (DESIGN.md Tata letak halaman): kolom 560 px di tengah.
export default function HalamanLupaPassword() {
  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Lupa password</h1>
      <p className="mt-2 text-pensil-redup">
        Isi email akun Member Anda. Kami kirim tautan untuk membuat password
        baru ke email itu.
      </p>
      <FormLupaPassword />
    </div>
  );
}
