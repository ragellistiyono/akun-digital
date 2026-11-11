import { asc, eq } from "drizzle-orm";

import { db } from "./db";
import { kategori, produk } from "./db/schema";

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
 * Item stok tidak ikut diubah; aturan mengubahnya dibuat di T28.
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
