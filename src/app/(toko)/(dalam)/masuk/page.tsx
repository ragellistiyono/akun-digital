import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { bacaSesiMember } from "@/server/auth/sesi-member";

import { FormMasuk } from "../../../_masuk/form-masuk";
import { aksiMasukMember } from "./aksi";
import {
  PESAN_PASSWORD_DIGANTI,
  TANDA_PASSWORD_DIGANTI,
} from "./password-diganti";

// Halaman Masuk Member (PRD §7.5), dibuka dari tombol Masuk di bilah atas, tab Akun, dan tab Riwayat (T51),
// dan menaut ke halaman Daftar dan Lupa password. Member yang sesinya masih berlaku langsung
// dibawa ke Riwayat Pesanan, sama seperti halaman login Admin. Setelah password diganti lewat Tautan atur
// ulang password, halaman ini menampilkan pesan bahwa password sudah diganti (PRD §7.5 ▶ Keputusan
// 2026-11-17).
export default async function HalamanMasuk({
  searchParams,
}: PageProps<"/masuk">) {
  if (await bacaSesiMember(await headers())) redirect("/riwayat");
  const passwordDiganti = z
    .literal(TANDA_PASSWORD_DIGANTI.nilai)
    .safeParse((await searchParams)[TANDA_PASSWORD_DIGANTI.nama]).success;

  return (
    <div className="max-w-[440px]">
      <h1 className="mt-4">Masuk</h1>
      {passwordDiganti && (
        <p role="status" className="mt-4 font-bold text-st-selesai">
          {PESAN_PASSWORD_DIGANTI}
        </p>
      )}
      <FormMasuk aksiMasuk={aksiMasukMember} />
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
