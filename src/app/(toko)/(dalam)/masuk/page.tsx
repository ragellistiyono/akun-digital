import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { bacaSesiMember } from "@/server/auth/sesi-member";

import { FormMasuk } from "../../../_masuk/form-masuk";
import { aksiMasukMember } from "./aksi";

// Halaman Masuk Member (PRD §7.5). Belum ditautkan dari halaman toko mana pun: tombol Masuk baru
// dipasang di T51 (PRD §13 ▶ Keputusan 2026-11-17). Member yang sesinya masih berlaku langsung
// dibawa ke Riwayat Pesanan, sama seperti halaman login Admin.
export default async function HalamanMasuk() {
  if (await bacaSesiMember(await headers())) redirect("/riwayat");

  return (
    <div className="max-w-[440px]">
      <h1 className="mt-4">Masuk</h1>
      <FormMasuk aksiMasuk={aksiMasukMember} />
    </div>
  );
}
