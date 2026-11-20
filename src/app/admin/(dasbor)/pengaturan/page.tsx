import { headers } from "next/headers";

import { wajibSesiAdmin } from "@/server/auth/sesi-admin";
import {
  bacaPengaturanBiayaTransaksi,
  bacaPengaturanToko,
} from "@/server/pengaturan-toko";

import { FormPengaturan } from "./_components/form-pengaturan";
import { nilaiIsianBiayaTransaksi } from "./nilai-isian-biaya-transaksi";

// Pengaturan toko (PRD §9.8): nomor WhatsApp, Ambang stok menipis (PRD §9.4), Biaya transaksi (PRD §14.3), dan
// teks halaman Syarat & Ketentuan serta Kebijakan Privasi.
export default async function HalamanPengaturanToko() {
  await wajibSesiAdmin(await headers());
  const [pengaturan, biayaTransaksi] = await Promise.all([
    bacaPengaturanToko(),
    bacaPengaturanBiayaTransaksi(),
  ]);

  return (
    <div className="tata-baca">
      <h1 className="mb-6">Pengaturan toko</h1>
      <FormPengaturan
        awal={{
          nilai: {
            ...pengaturan,
            nomorWhatsapp: pengaturan.nomorWhatsapp ?? "",
            ambangStokMenipis: String(pengaturan.ambangStokMenipis),
            ...nilaiIsianBiayaTransaksi(biayaTransaksi),
          },
        }}
      />
    </div>
  );
}
