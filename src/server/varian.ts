// Varian sebuah Produk (PRD §3.2, §3.5, §3.7). Aturan Harga jual dan Harga normal ada di
// src/domain/validasi-harga.ts dan diperiksa sebelum modul ini dipanggil.
import { and, asc, eq } from "drizzle-orm";

import { db } from "./db";
import { produk, varian } from "./db/schema";

/** Isian Varian yang diisi Admin, dengan harga dalam rupiah yang sudah diperiksa periksaHarga. */
type IsianVarian = {
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  aktif: boolean;
};

/**
 * Semua Varian sebuah Produk untuk dasbor admin, urut dari Harga jual termurah. Urutan ini keputusan
 * teknis, karena PRD tidak mengatur urutan Varian di dasbor admin.
 */
export async function daftarVarian(produkId: string) {
  return db
    .select({
      id: varian.id,
      nama: varian.nama,
      hargaJual: varian.hargaJual,
      hargaNormal: varian.hargaNormal,
      aktif: varian.aktif,
    })
    .from(varian)
    .where(eq(varian.produkId, produkId))
    .orderBy(asc(varian.hargaJual), asc(varian.nama), asc(varian.id));
}

/** Menambah Varian ke sebuah Produk. Bila Produk itu tidak ada, Varian tidak dibuat. */
export async function tambahVarian({
  produkId,
  ...isian
}: IsianVarian & { produkId: string }) {
  const [ada] = await db
    .select({ id: produk.id })
    .from(produk)
    .where(eq(produk.id, produkId));
  if (!ada) return { hasil: "produk-tidak-ada" } as const;

  await db.insert(varian).values({ produkId, ...isian });
  return { hasil: "dibuat" } as const;
}

/**
 * Mengubah isian Varian milik sebuah Produk, termasuk menonaktifkan dan mengaktifkannya kembali
 * (PRD §3.7). Varian yang tidak ada, atau milik Produk lain, tidak berubah.
 */
export async function ubahVarian({
  id,
  produkId,
  ...isian
}: IsianVarian & { id: string; produkId: string }) {
  const diubah = await db
    .update(varian)
    .set(isian)
    .where(and(eq(varian.id, id), eq(varian.produkId, produkId)))
    .returning({ id: varian.id });
  return diubah.length > 0
    ? ({ hasil: "diubah" } as const)
    : ({ hasil: "tidak-ada" } as const);
}
