import { redirect } from "next/navigation";

import { bacaEmailPendaftar } from "../email-pendaftar";
import { FormKirimUlang } from "./_components/form-kirim-ulang";

// Halaman verifikasi setelah mendaftar (PRD §7.2, §7.3): menyebut email tujuan Kode verifikasi dan
// menyediakan "Kirim ulang kode". Isian kodenya dibangun di T43. Browser yang belum mendaftar dibawa ke
// halaman Daftar.
export default async function HalamanVerifikasi() {
  const email = await bacaEmailPendaftar();
  if (!email) redirect("/daftar");

  return (
    <div className="max-w-[440px]">
      <h1 className="mt-4">Kode verifikasi</h1>
      <section className="mt-6 flex flex-col gap-4 rounded-[20px] bg-permukaan p-4 shadow-bayang">
        <p>
          Kode verifikasi 6 digit sudah kami kirim ke{" "}
          <strong className="font-extrabold [overflow-wrap:anywhere]">
            {email}
          </strong>
          . Kode berlaku 10 menit. Periksa juga folder spam.
        </p>
        <FormKirimUlang />
      </section>
    </div>
  );
}
