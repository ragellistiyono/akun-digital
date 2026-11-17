import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { bacaSesiMember } from "@/server/auth/sesi-member";

import { FormMasuk } from "../../../_masuk/form-masuk";
import { aksiMasukMember } from "./aksi";
import {
  alamatKembaliAman,
  PARAMETER_ALAMAT_KEMBALI,
  TUJUAN_SETELAH_MASUK,
} from "./alamat-kembali";
import {
  PESAN_PASSWORD_DIGANTI,
  TANDA_PASSWORD_DIGANTI,
} from "./password-diganti";

// Halaman Masuk Member (PRD §7.5), dibuka dari tombol Masuk di bilah atas, tab Akun, dan tab Riwayat (T51),
// dan menaut ke halaman Daftar dan Lupa password. Member yang sesinya masih berlaku langsung
// dibawa ke Riwayat Pesanan, sama seperti halaman login Admin. Setelah password diganti lewat Tautan atur
// ulang password, halaman ini menampilkan pesan bahwa password sudah diganti (PRD §7.5 ▶ Keputusan
// 2026-11-17).
//
// Tautan Masuk di pesan Voucher khusus Member membawa alamat kembali (`?kembali=/checkout?varianId=…`). Member
// dibawa ke alamat itu setelah login, atau langsung bila sesinya masih berlaku. Alamat kembali yang menunjuk ke
// luar toko diabaikan (PRD §7.5 dan §8.7 ▶ Keputusan 2026-11-17).
export default async function HalamanMasuk({
  searchParams,
}: PageProps<"/masuk">) {
  const parameter = await searchParams;
  const alamatKembali = alamatKembaliAman(parameter[PARAMETER_ALAMAT_KEMBALI]);
  if (await bacaSesiMember(await headers())) {
    redirect(alamatKembali ?? TUJUAN_SETELAH_MASUK);
  }
  const passwordDiganti = z
    .literal(TANDA_PASSWORD_DIGANTI.nilai)
    .safeParse(parameter[TANDA_PASSWORD_DIGANTI.nama]).success;

  return (
    <div className="max-w-[440px]">
      <h1 className="mt-4">Masuk</h1>
      {passwordDiganti && (
        <p role="status" className="mt-4 font-bold text-st-selesai">
          {PESAN_PASSWORD_DIGANTI}
        </p>
      )}
      <FormMasuk aksiMasuk={aksiMasukMember}>
        {alamatKembali && (
          <input
            type="hidden"
            name={PARAMETER_ALAMAT_KEMBALI}
            value={alamatKembali}
          />
        )}
      </FormMasuk>
      <p className="mt-4">
        <Link
          href="/lupa-password"
          className="text-sm font-bold text-aksi-teks underline decoration-[1.5px] underline-offset-4"
        >
          Lupa password?
        </Link>
      </p>
      <p className="mt-4 text-sm font-bold">
        Belum punya akun?{" "}
        <Link
          href="/daftar"
          className="text-aksi-teks underline decoration-[1.5px] underline-offset-4"
        >
          Daftar
        </Link>
      </p>
    </div>
  );
}
