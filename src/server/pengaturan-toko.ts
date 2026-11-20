import { eq } from "drizzle-orm";

import {
  MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL,
  PERSEN_BIAYA_TRANSAKSI_AWAL,
} from "@/domain/biaya-transaksi";
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

/**
 * Dua isian Biaya transaksi di Pengaturan toko (PRD §9.8, §14.3), yang sudah diperiksa
 * periksaIsianBiayaTransaksi. Persen ditulis sebagai angka, misalnya 0.7 untuk 0,7%.
 */
export type PengaturanBiayaTransaksi = {
  persen: number;
  minimalTotalBayar: number;
};

/**
 * Isian Biaya transaksi yang berlaku. Sebelum Admin pertama kali menyimpan, nilainya nilai awal PRD §14.3: persen
 * 0,7 dan minimal Total bayar Rp 100.000. Pemroses kabar pembayaran membacanya dengan `tx`, di dalam
 * transaksinya sendiri.
 */
export async function bacaPengaturanBiayaTransaksi(
  tx: Pick<typeof db, "select"> = db,
): Promise<PengaturanBiayaTransaksi> {
  const [baris] = await tx
    .select({
      persen: pengaturanToko.persenBiayaTransaksi,
      minimalTotalBayar: pengaturanToko.minimalTotalBayarBiayaTransaksi,
    })
    .from(pengaturanToko)
    .where(eq(pengaturanToko.id, ID_PENGATURAN));
  return (
    baris ?? {
      persen: PERSEN_BIAYA_TRANSAKSI_AWAL,
      minimalTotalBayar: MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL,
    }
  );
}

/**
 * Menimpa pengaturan toko dengan isian baru. Isian Biaya transaksi hanya ditimpa bila `biayaTransaksi`
 * diberikan; bila tidak, nilainya tetap, atau nilai awal bila pengaturan toko belum pernah disimpan.
 */
export async function simpanPengaturanToko(
  pengaturan: PengaturanToko,
  biayaTransaksi?: PengaturanBiayaTransaksi,
) {
  const isian = {
    ...pengaturan,
    ...(biayaTransaksi && {
      persenBiayaTransaksi: biayaTransaksi.persen,
      minimalTotalBayarBiayaTransaksi: biayaTransaksi.minimalTotalBayar,
    }),
  };
  await db
    .insert(pengaturanToko)
    .values({ id: ID_PENGATURAN, ...isian })
    .onConflictDoUpdate({ target: pengaturanToko.id, set: isian });
}
