// Bahan bersama untuk test yang menyiapkan katalog langsung di database. Berkas ini hanya diimpor oleh
// test integrasi dan test e2e.
import { randomUUID } from "node:crypto";

import type { StatusItemStok } from "@/domain/item-stok";

import { db } from "./db";
import { itemStok, kategori, produk, varian } from "./db/schema";

/** Varian uji beserta jumlah Item stok per status yang ikut dibuat. */
type VarianUji = {
  nama: string;
  hargaJual: number;
  hargaNormal?: number;
  aktif?: boolean;
} & Partial<Record<StatusItemStok, number>>;

/**
 * Menyisipkan Produk di Kategori barunya sendiri, beserta Varian dan Item stoknya. Isi Item stok tidak
 * dibaca katalog, jadi isinya cukup teks pengganti dengan sidik jari acak. Hasilnya id Produk itu.
 */
export async function sisipkanProduk({
  nama,
  unggulan = false,
  aktif = true,
  foto = [],
  varian: semuaVarian,
}: {
  nama: string;
  unggulan?: boolean;
  aktif?: boolean;
  foto?: string[];
  varian: VarianUji[];
}) {
  const [{ id: kategoriId }] = await db
    .insert(kategori)
    .values({
      nama: `Streaming ${randomUUID().slice(0, 8)}`,
      ikon: "ikon-uji.png",
    })
    .returning({ id: kategori.id });
  const [{ id: produkId }] = await db
    .insert(produk)
    .values({
      nama,
      kategoriId,
      deskripsi: "Deskripsi uji.",
      ketentuanGaransi: "Garansi uji.",
      unggulan,
      aktif,
      formatItemStok: ["Kode"],
      foto,
    })
    .returning({ id: produk.id });

  for (const v of semuaVarian) {
    const [{ id: varianId }] = await db
      .insert(varian)
      .values({
        produkId,
        nama: v.nama,
        hargaJual: v.hargaJual,
        hargaNormal: v.hargaNormal ?? null,
        aktif: v.aktif ?? true,
      })
      .returning({ id: varian.id });
    const item = (["Tersedia", "Ditahan", "Terkirim"] as const).flatMap(
      (status) =>
        Array.from({ length: v[status] ?? 0 }, () => ({
          varianId,
          status,
          isiTerenkripsi: "isi-uji",
          sidikJari: randomUUID(),
        })),
    );
    if (item.length > 0) await db.insert(itemStok).values(item);
  }
  return produkId;
}
