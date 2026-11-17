// Daftar Stok menipis di Ringkasan dasbor admin (PRD §9.2, §9.4). Aturannya ada di
// src/domain/stok-menipis.ts, dan Stok Varian dihitung oleh src/domain/stok-varian.ts (PRD §5.3).
import { asc, count, eq } from "drizzle-orm";

import type { StatusItemStok } from "@/domain/item-stok";
import { stokMenipis, urutkanStokMenipis } from "@/domain/stok-menipis";
import { stokVarian } from "@/domain/stok-varian";

import { db } from "./db";
import { itemStok, produk, varian } from "./db/schema";

/**
 * Varian yang stoknya menipis menurut Ambang stok menipis `ambang`, Stok Varian terkecil di atas. Setiap
 * Varian membawa nama Produk, nama Varian, dan Stok Varian-nya, dan hasilnya membawa ambang itu sebagai bahan
 * hitungnya.
 *
 * Varian dengan Stok Varian yang sama urut menurut nama Produk, lalu nama Varian. Urutan ini keputusan teknis,
 * karena PRD hanya mengatur Stok Varian terkecil di atas.
 */
export async function daftarStokMenipis({ ambang }: { ambang: number }) {
  const baris = await db
    .select({
      varianId: varian.id,
      namaVarian: varian.nama,
      aktif: varian.aktif,
      produkId: produk.id,
      namaProduk: produk.nama,
      produkAktif: produk.aktif,
      status: itemStok.status,
      jumlah: count(itemStok.id),
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(itemStok, eq(itemStok.varianId, varian.id))
    .groupBy(varian.id, produk.id, itemStok.status)
    .orderBy(asc(produk.nama), asc(varian.nama), asc(varian.id));

  const perVarian = new Map<
    string,
    Omit<(typeof baris)[number], "status" | "jumlah"> & {
      jumlahPerStatus: Record<StatusItemStok, number>;
    }
  >();
  for (const { status, jumlah, ...v } of baris) {
    const ada = perVarian.get(v.varianId) ?? {
      ...v,
      jumlahPerStatus: { Tersedia: 0, Ditahan: 0, Terkirim: 0 },
    };
    if (status !== null) ada.jumlahPerStatus[status] = jumlah;
    perVarian.set(v.varianId, ada);
  }

  const hasil = stokMenipis({
    ambang,
    varian: [...perVarian.values()].map(({ jumlahPerStatus, ...v }) => ({
      ...v,
      stokVarian: stokVarian({ jumlahPerStatus }).stokVarian,
    })),
  });
  return {
    ambang: hasil.ambang,
    varian: urutkanStokMenipis(hasil.menipis).map((v) => ({
      varianId: v.varianId,
      namaVarian: v.namaVarian,
      produkId: v.produkId,
      namaProduk: v.namaProduk,
      stokVarian: v.stokVarian,
    })),
  };
}
