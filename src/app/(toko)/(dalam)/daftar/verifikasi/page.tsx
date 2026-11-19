import { redirect } from "next/navigation";

import { bacaEmailPendaftar } from "../email-pendaftar";
import { VerifikasiKode } from "./_components/verifikasi-kode";

// Halaman verifikasi setelah mendaftar (PRD §7.2, §7.3): menyebut email tujuan Kode verifikasi, lalu
// menyediakan isian kode dan "Kirim ulang kode". Browser yang belum mendaftar dibawa ke halaman Daftar.
// Tata letak Fokus (DESIGN.md Tata letak halaman): kolom 560 px di tengah.
export default async function HalamanVerifikasi() {
  const email = await bacaEmailPendaftar();
  if (!email) redirect("/daftar");

  return (
    <div className="tata-fokus">
      <h1 className="mt-4">Kode verifikasi</h1>
      <section className="kartu selotip relative mt-6 flex flex-col gap-4 p-5">
        <p>
          Kode verifikasi 6 digit sudah kami kirim ke{" "}
          <strong className="font-spidol font-bold [overflow-wrap:anywhere]">
            {email}
          </strong>
          . Kode berlaku 10 menit. Periksa juga folder spam.
        </p>
        <VerifikasiKode />
      </section>
    </div>
  );
}
