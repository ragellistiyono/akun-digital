// Katalog toko: kartu Produk di Beranda (PRD §3.4–§3.8). Aturan harganya ada di
// src/domain/harga-kartu-produk.ts, src/domain/persen-hemat.ts, dan src/domain/stok-varian.ts.
import { asc, count, eq } from "drizzle-orm";

import { fotoSampul } from "@/domain/foto-produk";
import { hargaKartuProduk } from "@/domain/harga-kartu-produk";
import type { StatusItemStok } from "@/domain/item-stok";
import { persenHemat } from "@/domain/persen-hemat";
import { stokVarian, varianHabis } from "@/domain/stok-varian";

import { alamatBerkasUnggahan } from "./berkas-unggahan";
import { db } from "./db";
import { itemStok, produk, varian } from "./db/schema";

/** Satu Varian aktif di kartu Produk Unggulan, tanpa angka Stok Varian. */
type VarianKartu = {
  id: string;
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  habis: boolean;
};

/** Isi satu kartu Produk di katalog (PRD §3.8, docs/DESIGN.md "Cards / Containers"). */
export type KartuProduk = {
  id: string;
  nama: string;
  /** Alamat foto sampul, atau null bila Produk belum punya foto. */
  fotoSampul: string | null;
  mulai: boolean;
  harga: number;
  habis: boolean;
  /** Harga normal Varian sumber harga, yang tampil dicoret. */
  hargaNormal: number | null;
  /** Persen hemat Varian sumber harga, atau null bila Varian itu tanpa Harga normal. */
  persenHemat: number | null;
  /** Varian aktif, urut dari Harga jual termurah. */
  varian: VarianKartu[];
};

/**
 * Varian semua Produk aktif beserta jumlah Item stok per status, urut dari Harga jual termurah, lalu
 * nama. Urutan ini keputusan teknis, karena PRD tidak mengatur urutan Varian di kartu.
 */
async function varianProdukAktif() {
  const baris = await db
    .select({
      id: varian.id,
      produkId: varian.produkId,
      nama: varian.nama,
      hargaJual: varian.hargaJual,
      hargaNormal: varian.hargaNormal,
      aktif: varian.aktif,
      status: itemStok.status,
      jumlah: count(itemStok.id),
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .leftJoin(itemStok, eq(itemStok.varianId, varian.id))
    .where(eq(produk.aktif, true))
    .groupBy(varian.id, itemStok.status)
    .orderBy(asc(varian.hargaJual), asc(varian.nama), asc(varian.id));

  const perVarian = new Map<
    string,
    Omit<(typeof baris)[number], "status" | "jumlah"> & {
      jumlahPerStatus: Record<StatusItemStok, number>;
    }
  >();
  for (const { status, jumlah, ...v } of baris) {
    const ada = perVarian.get(v.id) ?? {
      ...v,
      jumlahPerStatus: { Tersedia: 0, Ditahan: 0, Terkirim: 0 },
    };
    if (status !== null) ada.jumlahPerStatus[status] = jumlah;
    perVarian.set(v.id, ada);
  }
  return [...perVarian.values()].map(({ jumlahPerStatus, ...v }) => ({
    ...v,
    stokVarian: stokVarian({ jumlahPerStatus }).stokVarian,
  }));
}

/**
 * Kartu Produk untuk Beranda (PRD §3.6): bagian Produk Unggulan, dan bagian semua Produk aktif yang
 * juga memuat Produk Unggulan. Produk nonaktif (PRD §3.7) dan Produk tanpa Varian aktif tidak tampil.
 *
 * Harga normal yang dicoret dan Persen hemat diambil dari Varian sumber harga (docs/DESIGN.md,
 * keputusan teknis "Mulai Rp X"). Kedua bagian urut menurut nama Produk; urutan ini keputusan teknis,
 * karena PRD tidak mengaturnya.
 */
export async function daftarProdukBeranda(): Promise<{
  unggulan: KartuProduk[];
  semua: KartuProduk[];
}> {
  const [semuaProduk, semuaVarian] = await Promise.all([
    db
      .select({
        id: produk.id,
        nama: produk.nama,
        foto: produk.foto,
        unggulan: produk.unggulan,
      })
      .from(produk)
      .where(eq(produk.aktif, true))
      .orderBy(asc(produk.nama), asc(produk.id)),
    varianProdukAktif(),
  ]);

  const varianPerProduk = Map.groupBy(semuaVarian, (v) => v.produkId);
  const unggulan: KartuProduk[] = [];
  const semua: KartuProduk[] = [];
  for (const p of semuaProduk) {
    const harga = hargaKartuProduk({
      varian: varianPerProduk.get(p.id) ?? [],
    });
    if (harga === null) continue;

    const { hargaNormal, hargaJual } = harga.sumber;
    const sampul = fotoSampul(p.foto);
    const kartu: KartuProduk = {
      id: p.id,
      nama: p.nama,
      fotoSampul: sampul === null ? null : alamatBerkasUnggahan(sampul),
      mulai: harga.mulai,
      harga: harga.harga,
      habis: harga.habis,
      hargaNormal,
      persenHemat: persenHemat({ hargaNormal, hargaJual }).persenHemat,
      varian: harga.varianAktif.map((v) => ({
        id: v.id,
        nama: v.nama,
        hargaJual: v.hargaJual,
        hargaNormal: v.hargaNormal,
        habis: varianHabis(v.stokVarian),
      })),
    };
    semua.push(kartu);
    if (p.unggulan) unggulan.push(kartu);
  }
  return { unggulan, semua };
}
