import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import { bacaPengaturanToko } from "@/server/pengaturan-toko";

import { FormPengaturan } from "./_components/form-pengaturan";

// Pengaturan toko (PRD §9.8). Isian Ambang stok menipis menyusul di M2 (PRD §13 ▶ Keputusan 2026-11-11).
export default async function HalamanPengaturanToko() {
  await wajibSesiAdmin(await headers());
  const pengaturan = await bacaPengaturanToko();

  return (
    <>
      <h1>Pengaturan toko</h1>
      <FormPengaturan
        awal={{
          nilai: {
            ...pengaturan,
            nomorWhatsapp: pengaturan.nomorWhatsapp ?? "",
          },
        }}
      />
    </>
  );
}
