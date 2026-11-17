// Membuat, mengubah, menonaktifkan, mengaktifkan kembali, dan menghapus Voucher, serta menghitung pemakaiannya
// (PRD §8.5, §8.8). Pemeriksaan bahwa yang mengubah adalah Admin, dan pemeriksaan isian selain kode
// (periksaIsianVoucher), dilakukan Server Action pemanggilnya.
import {
  asc,
  count,
  desc,
  DrizzleQueryError,
  eq,
  inArray,
  isNotNull,
} from "drizzle-orm";
import postgres from "postgres";

import { bolehHapusVoucher } from "@/domain/hapus-voucher";
import type { CakupanVoucher, IsianVoucher } from "@/domain/isian-voucher";
import {
  periksaKodeVoucher,
  type AlasanKodeVoucherDitolak,
} from "@/domain/kode-voucher";
import { pemakaianVoucher } from "@/domain/pemakaian-voucher";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import {
  kategori,
  pesanan,
  produk,
  voucher,
  voucherKategori,
  voucherProduk,
} from "./db/schema";

/** Voucher yang tersimpan, dengan semua syaratnya selain daftar Produk atau Kategori di cakupannya. */
export type Voucher = typeof voucher.$inferSelect;

/** Syarat Voucher yang diisi Admin selain kode, termasuk Cakupan voucher. */
export type SyaratVoucher = IsianVoucher & {
  khususMember: boolean;
  aktif: boolean;
};

type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Semua Voucher, terbaru di atas, beserta pemakaiannya menurut pemakaianVoucher (PRD §8.5, §8.8 ▶ Keputusan
 * 2026-11-17). Pemakaian dihitung dari email dan status semua Pesanan yang mencatat Voucher itu.
 */
export async function daftarVoucher(): Promise<
  (Voucher & { pemakaian: number })[]
> {
  const [semuaVoucher, pesananDenganVoucher] = await Promise.all([
    db
      .select()
      .from(voucher)
      .orderBy(desc(voucher.dibuatPada), desc(voucher.id)),
    db
      .select({
        voucherId: pesanan.voucherId,
        email: pesanan.email,
        status: pesanan.status,
      })
      .from(pesanan)
      .where(isNotNull(pesanan.voucherId)),
  ]);
  const pesananPerVoucher = Map.groupBy(
    pesananDenganVoucher,
    (p) => p.voucherId,
  );
  return semuaVoucher.map((v) => ({
    ...v,
    pemakaian: pemakaianVoucher({
      emailCheckout: null,
      pesananDenganVoucher: pesananPerVoucher.get(v.id) ?? [],
    }).total,
  }));
}

/**
 * Satu Voucher menurut id-nya beserta Cakupan voucher-nya, atau null bila tidak ada. Daftar Produk atau
 * Kategori di cakupan berisi id, urut menurut id.
 */
export async function bacaVoucher(
  id: string,
): Promise<(Omit<Voucher, "cakupan"> & { cakupan: CakupanVoucher }) | null> {
  const [baris] = await db.select().from(voucher).where(eq(voucher.id, id));
  if (!baris) return null;
  if (baris.cakupan === "semua") {
    return { ...baris, cakupan: { jenis: "semua" } };
  }
  const daftar =
    baris.cakupan === "produk"
      ? await db
          .select({ id: voucherProduk.produkId })
          .from(voucherProduk)
          .where(eq(voucherProduk.voucherId, id))
          .orderBy(asc(voucherProduk.produkId))
      : await db
          .select({ id: voucherKategori.kategoriId })
          .from(voucherKategori)
          .where(eq(voucherKategori.voucherId, id))
          .orderBy(asc(voucherKategori.kategoriId));
  return {
    ...baris,
    cakupan: { jenis: baris.cakupan, daftar: daftar.map((b) => b.id) },
  };
}

/**
 * Menyimpan daftar Produk atau Kategori di Cakupan voucher sebuah Voucher, menggantikan daftar sebelumnya.
 *
 * Produk atau Kategori yang dipilih dikunci FOR KEY SHARE lebih dulu, urut menurut id. Penghapusan Produk
 * (hapusProduk) dan Kategori (hapusKategori) mengunci barisnya FOR UPDATE, jadi penghapusan itu menunggu
 * transaksi ini selesai lalu ikut menghapus barisnya dari cakupan, atau transaksi ini menunggu penghapusan
 * itu dan tidak lagi menemukan barisnya. Produk atau Kategori yang sudah dihapus, misalnya dari form yang
 * dibuka sebelum penghapusan, ikut hilang dari cakupan (T54).
 */
async function simpanDaftarCakupan(
  tx: Transaksi,
  voucherId: string,
  cakupan: CakupanVoucher,
) {
  const daftar = cakupan.jenis === "semua" ? [] : [...new Set(cakupan.daftar)];
  const produkAda =
    cakupan.jenis === "produk" && daftar.length > 0
      ? await tx
          .select({ id: produk.id })
          .from(produk)
          .where(inArray(produk.id, daftar))
          .orderBy(asc(produk.id))
          .for("key share")
      : [];
  const kategoriAda =
    cakupan.jenis === "kategori" && daftar.length > 0
      ? await tx
          .select({ id: kategori.id })
          .from(kategori)
          .where(inArray(kategori.id, daftar))
          .orderBy(asc(kategori.id))
          .for("key share")
      : [];

  await tx.delete(voucherProduk).where(eq(voucherProduk.voucherId, voucherId));
  await tx
    .delete(voucherKategori)
    .where(eq(voucherKategori.voucherId, voucherId));
  if (produkAda.length > 0) {
    await tx
      .insert(voucherProduk)
      .values(produkAda.map(({ id }) => ({ voucherId, produkId: id })));
  }
  if (kategoriAda.length > 0) {
    await tx
      .insert(voucherKategori)
      .values(kategoriAda.map(({ id }) => ({ voucherId, kategoriId: id })));
  }
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
  cakupan,
  ...syarat
}: SyaratVoucher & { kode: string }): Promise<HasilBuatVoucher> {
  const kodeLain = await db.select({ kode: voucher.kode }).from(voucher);
  const periksa = periksaKodeVoucher({
    kode,
    kodeLain: kodeLain.map((baris) => baris.kode),
  });
  if (!periksa.sah) return { hasil: "kode-ditolak", alasan: periksa.alasan };

  try {
    await db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(voucher)
        .values({ kode: periksa.kode, ...syarat, cakupan: cakupan.jenis })
        .returning({ id: voucher.id });
      await simpanDaftarCakupan(tx, id, cakupan);
    });
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
  cakupan,
  ...syarat
}: SyaratVoucher & { id: string }): Promise<
  { hasil: "diubah" } | { hasil: "tidak-ada" }
> {
  return db.transaction(async (tx) => {
    const diubah = await tx
      .update(voucher)
      .set({ ...syarat, cakupan: cakupan.jenis })
      .where(eq(voucher.id, id))
      .returning({ id: voucher.id });
    if (diubah.length === 0) return { hasil: "tidak-ada" } as const;
    await simpanDaftarCakupan(tx, id, cakupan);
    return { hasil: "diubah" } as const;
  });
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

/**
 * Menghapus Voucher yang belum pernah tercatat di Pesanan (PRD §8.8). Voucher yang tercatat di Pesanan
 * berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan, tidak dihapus menurut bolehHapusVoucher, dan
 * hasilnya membawa jumlah Pesanan itu. Daftar Produk atau Kategori di cakupannya ikut terhapus lewat foreign
 * key-nya (ON DELETE CASCADE). Hasilnya "tidak-ada" bila tidak ada Voucher dengan id itu.
 *
 * Baris Voucher dikunci FOR UPDATE sebelum Pesanannya dihitung. Pesanan baru yang mencatat Voucher ini
 * mengunci baris yang sama FOR KEY SHARE lewat foreign key-nya, jadi Pesanan yang tersimpan lebih dulu ikut
 * terhitung, dan Pesanan yang datang belakangan menunggu transaksi ini lalu ditolak foreign key-nya bila
 * Voucher-nya terhapus.
 */
export async function hapusVoucher(
  id: string,
): Promise<
  | { hasil: "dihapus" }
  | { hasil: "tidak-ada" }
  | { hasil: "pernah-dipakai"; jumlahPesanan: number }
> {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ id: voucher.id })
      .from(voucher)
      .where(eq(voucher.id, id))
      .for("update");
    if (!terkunci) return { hasil: "tidak-ada" } as const;

    const jumlahPesananPerStatus: Partial<Record<StatusPesanan, number>> = {};
    const semua = await tx
      .select({ status: pesanan.status, jumlah: count() })
      .from(pesanan)
      .where(eq(pesanan.voucherId, id))
      .groupBy(pesanan.status);
    for (const baris of semua)
      jumlahPesananPerStatus[baris.status] = baris.jumlah;

    const boleh = bolehHapusVoucher({ jumlahPesananPerStatus });
    if (!boleh.boleh) {
      return {
        hasil: "pernah-dipakai",
        jumlahPesanan: boleh.jumlahPesanan,
      } as const;
    }

    await tx.delete(voucher).where(eq(voucher.id, id));
    return { hasil: "dihapus" } as const;
  });
}
