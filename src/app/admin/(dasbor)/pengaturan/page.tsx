import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { FormPengaturan } from "./_components/form-pengaturan";

// Pengaturan toko (PRD §9.8): nomor WhatsApp, Ambang stok menipis (PRD §9.4), dan teks halaman Syarat &
// Ketentuan serta Kebijakan Privasi.
export default async function HalamanPengaturanToko() {
  await wajibSesiAdmin(await headers());
  const pengaturan = await bacaPengaturanToko();

  return (
    <div className="tata-baca">
      <h1 className="mb-6">Pengaturan toko</h1>
      <FormPengaturan
        awal={{
          nilai: {
            ...pengaturan,
            nomorWhatsapp: pengaturan.nomorWhatsapp ?? "",
            ambangStokMenipis: String(pengaturan.ambangStokMenipis),
          },
        }}
      />
    </div>
  );
}
