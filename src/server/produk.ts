import { asc, count, eq } from "drizzle-orm";

import {
  bolehUbahFormatItemStok,
  perubahanFormatItemStok,
  type KolomFormatBaru,
} from "@/domain/format-item-stok";

import { db } from "./db";
import { itemStok, kategori, produk, varian } from "./db/schema";

/** Isian Produk yang diisi Admin di form, baik saat membuat maupun mengubah (PRD §3.2, §3.3). */
type IsianProduk = {
  nama: string;
  kategoriId: string;
  deskripsi: string;
  ketentuanGaransi: string;
  unggulan: boolean;
  aktif: boolean;
};

/** Semua Produk untuk daftar di dasbor admin, urut menurut nama. */
export async function daftarProduk() {
  return db
    .select({
      id: produk.id,
      nama: produk.nama,
      namaKategori: kategori.nama,
      unggulan: produk.unggulan,
      aktif: produk.aktif,
    })
    .from(produk)
    .innerJoin(kategori, eq(produk.kategoriId, kategori.id))
    .orderBy(asc(produk.nama), asc(produk.id));
}

/** Satu Produk beserta Format Item stok-nya, atau null bila tidak ada. */
export async function bacaProduk(id: string) {
  const [baris] = await db.select().from(produk).where(eq(produk.id, id));
  return baris ?? null;
}

async function kategoriAda(id: string) {
  const [ada] = await db
    .select({ id: kategori.id })
    .from(kategori)
    .where(eq(kategori.id, id));
  return ada !== undefined;
}

/**
 * Membuat Produk di Kategori yang dipilih, dengan Format Item stok yang sudah diperiksa
 * (periksaFormatItemStok). Bila Kategori itu tidak ada, Produk tidak dibuat.
 */
export async function buatProduk(
  isian: IsianProduk & { formatItemStok: string[] },
) {
  if (!(await kategoriAda(isian.kategoriId))) {
    return { hasil: "kategori-tidak-ada" } as const;
  }
  await db.insert(produk).values(isian);
  return { hasil: "dibuat" } as const;
}

/**
 * Mengubah isian Produk, termasuk Kategori, tanda Produk Unggulan, dan aktif atau nonaktif. Format
 * Item stok tidak ikut diubah; Format Item stok diubah lewat ubahFormatItemStok.
 */
export async function ubahProduk({
  id,
  ...isian
}: IsianProduk & { id: string }) {
  if (!(await kategoriAda(isian.kategoriId))) {
    return { hasil: "kategori-tidak-ada" } as const;
  }
  const diubah = await db
    .update(produk)
    .set(isian)
    .where(eq(produk.id, id))
    .returning({ id: produk.id });
  return diubah.length > 0
    ? ({ hasil: "diubah" } as const)
    : ({ hasil: "tidak-ada" } as const);
}

/**
 * Mengubah Format Item stok sebuah Produk (PRD §4.1) menjadi Format baru yang nama kolomnya sudah diperiksa
 * (periksaFormatItemStok). Perubahannya dikenali perubahanFormatItemStok, lalu setiap perubahan diperiksa
 * bolehUbahFormatItemStok menurut jumlah Item stok Tersedia dan Ditahan di semua Varian Produk itu. Bila ada
 * perubahan yang tidak boleh, Format tidak berubah sama sekali, dan hasilnya memuat perubahan yang ditolak
 * beserta jumlah itu sebagai sebabnya. Item stok Terkirim tidak ikut diubah, karena tampil dengan nama kolom
 * yang dicatat saat Terkirim.
 *
 * Baris Produk dikunci FOR UPDATE lebih dulu, baru Item stok-nya dihitung, supaya Item stok Tersedia yang
 * muncul di tengah jalan tidak terlewat:
 * - Pengisian Item stok (isiVarian di item-stok.ts) juga mengunci baris Produk itu dengan FOR UPDATE sebelum
 *   membaca Format dan menyimpan Item stok. Jadi pengisian yang lebih dulu membuat transaksi ini menunggu,
 *   lalu Item stok barunya ikut terhitung; pengisian yang datang belakangan menunggu transaksi ini selesai,
 *   lalu memakai Format barunya.
 * - Checkout hanya memindahkan Item stok Tersedia menjadi Ditahan, dan pembatalan atau kedaluwarsa
 *   sebaliknya, padahal keduanya sama-sama dihitung. Perubahan status yang belum selesai terlihat dengan
 *   status lamanya, jadi Item stok yang sedang dikirim masih dihitung Tersedia atau Ditahan, dan penolakannya
 *   berpihak pada keamanan isi Item stok.
 */
export async function ubahFormatItemStok({
  produkId,
  formatBaru,
}: {
  produkId: string;
  formatBaru: KolomFormatBaru[];
}) {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ formatItemStok: produk.formatItemStok })
      .from(produk)
      .where(eq(produk.id, produkId))
      .for("update");
    if (!terkunci) return { hasil: "tidak-ada" } as const;

    const jumlahPerStatus = { Tersedia: 0, Ditahan: 0, Terkirim: 0 };
    const semua = await tx
      .select({ status: itemStok.status, jumlah: count() })
      .from(itemStok)
      .innerJoin(varian, eq(itemStok.varianId, varian.id))
      .where(eq(varian.produkId, produkId))
      .groupBy(itemStok.status);
    for (const { status, jumlah } of semua) jumlahPerStatus[status] = jumlah;
    const bahan = {
      jumlahTersedia: jumlahPerStatus.Tersedia,
      jumlahDitahan: jumlahPerStatus.Ditahan,
    };

    const ditolak = perubahanFormatItemStok({
      formatLama: terkunci.formatItemStok,
      formatBaru,
    }).filter(
      (perubahan) => !bolehUbahFormatItemStok({ perubahan, ...bahan }).boleh,
    );
    if (ditolak.length > 0) {
      return { hasil: "tidak-boleh", ditolak, ...bahan } as const;
    }

    await tx
      .update(produk)
      .set({ formatItemStok: formatBaru.map((kolom) => kolom.nama) })
      .where(eq(produk.id, produkId));
    return { hasil: "diubah" } as const;
  });
}
