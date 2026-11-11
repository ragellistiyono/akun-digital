import { eq } from "drizzle-orm";

import { db } from "./db";
import { pengaturanToko } from "./db/schema";

/** Isian Pengaturan toko (PRD §9.8). Nomor WhatsApp null berarti belum diisi. */
export type PengaturanToko = {
  nomorWhatsapp: string | null;
  syaratKetentuan: string;
  kebijakanPrivasi: string;
};

// Baris tunggal pengaturan toko selalu ber-id 1 (lihat skema).
const ID_PENGATURAN = 1;

/** Pengaturan toko yang berlaku. Sebelum Admin pertama kali menyimpan, semua isiannya kosong. */
export async function bacaPengaturanToko(): Promise<PengaturanToko> {
  const [baris] = await db
    .select({
      nomorWhatsapp: pengaturanToko.nomorWhatsapp,
      syaratKetentuan: pengaturanToko.syaratKetentuan,
      kebijakanPrivasi: pengaturanToko.kebijakanPrivasi,
    })
    .from(pengaturanToko)
    .where(eq(pengaturanToko.id, ID_PENGATURAN));
  return (
    baris ?? { nomorWhatsapp: null, syaratKetentuan: "", kebijakanPrivasi: "" }
  );
}

/** Menimpa seluruh pengaturan toko dengan isian baru. */
export async function simpanPengaturanToko(pengaturan: PengaturanToko) {
  await db
    .insert(pengaturanToko)
    .values({ id: ID_PENGATURAN, ...pengaturan })
    .onConflictDoUpdate({ target: pengaturanToko.id, set: pengaturan });
}
