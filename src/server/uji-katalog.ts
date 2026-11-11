// Bahan bersama untuk test yang menyiapkan katalog langsung di database. Berkas ini hanya diimpor oleh
// test integrasi dan test e2e.
import { randomUUID } from "node:crypto";

import type { StatusItemStok } from "@/domain/item-stok";

import { db } from "./db";
import { itemStok, kategori, produk, varian } from "./db/schema";
import {
  bacaKunciItemStok,
  enkripsiItemStok,
  sidikJariItemStok,
} from "./enkripsi-item-stok";

/** Varian uji beserta jumlah Item stok per status yang ikut dibuat. */
type VarianUji = {
  nama: string;
  hargaJual: number;
  hargaNormal?: number;
  aktif?: boolean;
} & Partial<Record<StatusItemStok, number>>;

/**
 * Isi terenkripsi dan sidik jari sebuah Item stok uji, dengan ITEM_STOK_KEY dari .env.ci, supaya isinya
 * bisa dibuka seperti Item stok yang diisi Admin.
 */
export function isiItemStokUji(nilai: string[]) {
  const kunci = bacaKunciItemStok();
  if (kunci.hasil !== "ada") {
    throw new Error(
      "ITEM_STOK_KEY di .env.ci belum diisi atau tidak sah, jadi Item stok uji tidak bisa dienkripsi. Isi ITEM_STOK_KEY di .env.ci dengan 32 byte acak dalam base64, lalu jalankan ulang test-nya.",
    );
  }
  return {
    isiTerenkripsi: enkripsiItemStok(kunci.kunci, nilai),
    sidikJari: sidikJariItemStok(kunci.kunci, nilai),
  };
}

/** Menyisipkan Kategori dengan gambar ikon pengganti. Hasilnya id Kategori itu. */
export async function sisipkanKategori({
  nama,
  ikon = "ikon-uji.png",
}: {
  nama: string;
  ikon?: string;
}) {
  const [{ id }] = await db
    .insert(kategori)
    .values({ nama, ikon })
    .returning({ id: kategori.id });
  return id;
}

/**
 * Menyisipkan Produk beserta Varian dan Item stoknya, di Kategori yang diberikan atau di Kategori barunya
 * sendiri. Setiap Item stok berisi teks uji acak untuk setiap kolom Format Item stok, terenkripsi seperti
 * Item stok yang diisi Admin, supaya Item stok yang Terkirim bisa tampil di halaman Pesanan. Hasilnya id
 * Produk itu.
 */
export async function sisipkanProduk({
  nama,
  kategoriId,
  unggulan = false,
  aktif = true,
  foto = [],
  deskripsi = "Deskripsi uji.",
  ketentuanGaransi = "Garansi uji.",
  formatItemStok = ["Kode"],
  varian: semuaVarian,
}: {
  nama: string;
  kategoriId?: string;
  unggulan?: boolean;
  aktif?: boolean;
  foto?: string[];
  deskripsi?: string;
  ketentuanGaransi?: string;
  formatItemStok?: string[];
  varian: VarianUji[];
}) {
  kategoriId ??= await sisipkanKategori({
    nama: `Streaming ${randomUUID().slice(0, 8)}`,
  });
  const [{ id: produkId }] = await db
    .insert(produk)
    .values({
      nama,
      kategoriId,
      deskripsi,
      ketentuanGaransi,
      unggulan,
      aktif,
      formatItemStok,
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
          ...isiItemStokUji(
            formatItemStok.map((kolom) => `${kolom} uji ${randomUUID()}`),
          ),
        })),
    );
    if (item.length > 0) await db.insert(itemStok).values(item);
  }
  return produkId;
}
