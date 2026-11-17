// Membuat, mengubah, menonaktifkan, dan mengaktifkan kembali Voucher (PRD §8.8). Pemeriksaan bahwa yang
// mengubah adalah Admin, dan pemeriksaan isian selain kode (periksaIsianVoucher), dilakukan Server Action
// pemanggilnya.
import { desc, DrizzleQueryError, eq } from "drizzle-orm";
import postgres from "postgres";

import type { IsianVoucher } from "@/domain/isian-voucher";
import {
  periksaKodeVoucher,
  type AlasanKodeVoucherDitolak,
} from "@/domain/kode-voucher";

import { db } from "./db";
import { voucher } from "./db/schema";

/** Voucher yang tersimpan, dengan semua syaratnya. */
export type Voucher = typeof voucher.$inferSelect;

/**
 * Syarat Voucher yang diisi Admin selain kode. Cakupan voucher untuk sementara selalu semua Produk (T53),
 * jadi tidak disimpan.
 */
export type SyaratVoucher = Omit<IsianVoucher, "cakupan"> & {
  khususMember: boolean;
  aktif: boolean;
};

/** Semua Voucher, terbaru di atas (PRD §8.8 ▶ Keputusan 2026-11-17). */
export async function daftarVoucher(): Promise<Voucher[]> {
  return db
    .select()
    .from(voucher)
    .orderBy(desc(voucher.dibuatPada), desc(voucher.id));
}

/** Satu Voucher menurut id-nya, atau null bila tidak ada. */
export async function bacaVoucher(id: string): Promise<Voucher | null> {
  const [baris] = await db.select().from(voucher).where(eq(voucher.id, id));
  return baris ?? null;
}

/**
 * Apakah penulisan ditolak indeks unik kode Voucher. Ini terjadi bila Voucher lain dengan kode yang sama
 * tersimpan bersamaan, setelah pemeriksaan kode selesai.
 */
const ditolakIndeksKode = (galat: unknown) =>
  galat instanceof DrizzleQueryError &&
  galat.cause instanceof postgres.PostgresError &&
  galat.cause.code === "23505" &&
  galat.cause.constraint_name === "voucher_kode_unik";

type HasilBuatVoucher =
  | { hasil: "dibuat" }
  | { hasil: "kode-ditolak"; alasan: AlasanKodeVoucherDitolak };

/**
 * Membuat Voucher baru (PRD §8.4 ▶ Keputusan 2026-11-17). Kode diperiksa periksaKodeVoucher terhadap kode
 * semua Voucher lain, lalu disimpan dalam bentuk bakunya: huruf besar tanpa spasi di awal dan akhir.
 */
export async function buatVoucher({
  kode,
  ...syarat
}: SyaratVoucher & { kode: string }): Promise<HasilBuatVoucher> {
  const kodeLain = await db.select({ kode: voucher.kode }).from(voucher);
  const periksa = periksaKodeVoucher({
    kode,
    kodeLain: kodeLain.map((baris) => baris.kode),
  });
  if (!periksa.sah) return { hasil: "kode-ditolak", alasan: periksa.alasan };

  try {
    await db.insert(voucher).values({ kode: periksa.kode, ...syarat });
  } catch (galat) {
    if (ditolakIndeksKode(galat)) {
      return { hasil: "kode-ditolak", alasan: "kembar" };
    }
    throw galat;
  }
  return { hasil: "dibuat" };
}

/**
 * Mengubah syarat sebuah Voucher. Kode tidak bisa diubah setelah Voucher dibuat (PRD §8.4 ▶ Keputusan
 * 2026-11-17), jadi tidak termasuk isian yang diubah. Hasilnya "tidak-ada" bila tidak ada Voucher dengan id
 * itu.
 */
export async function ubahVoucher({
  id,
  ...syarat
}: SyaratVoucher & { id: string }): Promise<
  { hasil: "diubah" } | { hasil: "tidak-ada" }
> {
  const diubah = await db
    .update(voucher)
    .set(syarat)
    .where(eq(voucher.id, id))
    .returning({ id: voucher.id });
  return diubah.length === 0 ? { hasil: "tidak-ada" } : { hasil: "diubah" };
}

/**
 * Menonaktifkan Voucher atau mengaktifkannya kembali (PRD §8.8). Hasilnya "tidak-ada" bila tidak ada Voucher
 * dengan id itu.
 */
export async function ubahStatusVoucher({
  id,
  aktif,
}: {
  id: string;
  aktif: boolean;
}): Promise<{ hasil: "diubah" } | { hasil: "tidak-ada" }> {
  const diubah = await db
    .update(voucher)
    .set({ aktif })
    .where(eq(voucher.id, id))
    .returning({ id: voucher.id });
  return diubah.length === 0 ? { hasil: "tidak-ada" } : { hasil: "diubah" };
}
