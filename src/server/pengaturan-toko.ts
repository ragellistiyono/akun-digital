import { eq } from "drizzle-orm";

import { AMBANG_STOK_MENIPIS_AWAL } from "@/domain/stok-menipis";

import { db } from "./db";
import { pengaturanToko } from "./db/schema";

/**
 * Isian Pengaturan toko (PRD §9.8). Nomor WhatsApp null berarti belum diisi. Ambang stok menipis sudah
 * diperiksa periksaAmbangStokMenipis.
 */
export type PengaturanToko = {
  nomorWhatsapp: string | null;
  syaratKetentuan: string;
  kebijakanPrivasi: string;
  ambangStokMenipis: number;
};

// Baris tunggal pengaturan toko selalu ber-id 1 (lihat skema).
const ID_PENGATURAN = 1;

/**
 * Pengaturan toko yang berlaku. Sebelum Admin pertama kali menyimpan, semua isiannya kosong dan Ambang stok
 * menipis bernilai awal 5 (PRD §9.4).
 */
export async function bacaPengaturanToko(): Promise<PengaturanToko> {
  const [baris] = await db
    .select({
      nomorWhatsapp: pengaturanToko.nomorWhatsapp,
      syaratKetentuan: pengaturanToko.syaratKetentuan,
      kebijakanPrivasi: pengaturanToko.kebijakanPrivasi,
      ambangStokMenipis: pengaturanToko.ambangStokMenipis,
    })
    .from(pengaturanToko)
    .where(eq(pengaturanToko.id, ID_PENGATURAN));
  return (
    baris ?? {
      nomorWhatsapp: null,
      syaratKetentuan: "",
      kebijakanPrivasi: "",
      ambangStokMenipis: AMBANG_STOK_MENIPIS_AWAL,
    }
  );
}

/** Menimpa seluruh pengaturan toko dengan isian baru. */
export async function simpanPengaturanToko(pengaturan: PengaturanToko) {
  await db
    .insert(pengaturanToko)
    .values({ id: ID_PENGATURAN, ...pengaturan })
    .onConflictDoUpdate({ target: pengaturanToko.id, set: pengaturan });
}
