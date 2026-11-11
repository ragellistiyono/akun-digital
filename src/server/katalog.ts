// Katalog toko: kartu Produk, pencarian, dan Kategori di Beranda serta tab Kategori, juga Halaman Produk
// (PRD §3.1–§3.8). Aturan harganya ada di src/domain/harga-kartu-produk.ts, src/domain/persen-hemat.ts,
// dan src/domain/stok-varian.ts; aturan Kategori yang tampil dan pencarian ada di
// src/domain/saringan-katalog.ts; aturan Varian di Halaman Produk ada di src/domain/varian-halaman-produk.ts.
import { and, asc, count, eq } from "drizzle-orm";

import { fotoSampul } from "@/domain/foto-produk";
import { hargaKartuProduk } from "@/domain/harga-kartu-produk";
import type { StatusItemStok } from "@/domain/item-stok";
import { persenHemat, persenHematVarian } from "@/domain/persen-hemat";
import { kategoriTampil, saringProdukBeranda } from "@/domain/saringan-katalog";
import { stokVarian } from "@/domain/stok-varian";
import { varianHalamanProduk } from "@/domain/varian-halaman-produk";

import { alamatBerkasUnggahan } from "./berkas-unggahan";
import { db } from "./db";
import { itemStok, kategori, produk, varian } from "./db/schema";
import { daftarKategori, type Kategori } from "./kategori";

/** Satu Varian aktif di kartu Produk Unggulan, tanpa angka Stok Varian. */
type VarianKartu = {
  id: string;
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  habis: boolean;
  /** Persen hemat Varian ini, atau null bila Varian ini habis atau tanpa Harga normal. */
  persenHemat: number | null;
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
 * Varian semua Produk aktif, atau Varian satu Produk aktif bila produkId diberikan, beserta jumlah Item
 * stok per status, urut dari Harga jual termurah, lalu nama. Urutan ini keputusan teknis, karena PRD
 * tidak mengatur urutan Varian di kartu maupun di Halaman Produk.
 */
async function varianProdukAktif(produkId?: string) {
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
    .where(
      and(
        eq(produk.aktif, true),
        produkId === undefined ? undefined : eq(produk.id, produkId),
      ),
    )
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

/** Produk yang tampil di katalog: kartunya, beserta Kategori dan tanda Produk Unggulan. */
type ProdukKatalog = {
  nama: string;
  kategoriId: string;
  unggulan: boolean;
  kartu: KartuProduk;
};

/**
 * Semua Produk yang tampil di katalog, urut menurut nama Produk. Produk nonaktif (PRD §3.7) dan Produk
 * tanpa Varian aktif tidak tampil. Urutan nama ini keputusan teknis, karena PRD tidak mengaturnya.
 *
 * Harga normal yang dicoret dan Persen hemat diambil dari Varian sumber harga (docs/DESIGN.md,
 * keputusan teknis "Mulai Rp X").
 */
async function produkKatalog(): Promise<ProdukKatalog[]> {
  const [semuaProduk, semuaVarian] = await Promise.all([
    db
      .select({
        id: produk.id,
        nama: produk.nama,
        kategoriId: produk.kategoriId,
        foto: produk.foto,
        unggulan: produk.unggulan,
      })
      .from(produk)
      .where(eq(produk.aktif, true))
      .orderBy(asc(produk.nama), asc(produk.id)),
    varianProdukAktif(),
  ]);

  const varianPerProduk = Map.groupBy(semuaVarian, (v) => v.produkId);
  const hasil: ProdukKatalog[] = [];
  for (const p of semuaProduk) {
    const harga = hargaKartuProduk({
      varian: varianPerProduk.get(p.id) ?? [],
    });
    if (harga === null) continue;

    const { hargaNormal, hargaJual } = harga.sumber;
    const sampul = fotoSampul(p.foto);
    hasil.push({
      nama: p.nama,
      kategoriId: p.kategoriId,
      unggulan: p.unggulan,
      kartu: {
        id: p.id,
        nama: p.nama,
        fotoSampul: sampul === null ? null : alamatBerkasUnggahan(sampul),
        mulai: harga.mulai,
        harga: harga.harga,
        habis: harga.habis,
        hargaNormal,
        persenHemat: persenHemat({ hargaNormal, hargaJual }).persenHemat,
        varian: harga.varianAktif.map((v) => {
          const hemat = persenHematVarian(v);
          return {
            id: v.id,
            nama: v.nama,
            hargaJual: v.hargaJual,
            hargaNormal: v.hargaNormal,
            habis: hemat.habis,
            persenHemat: hemat.persenHemat,
          };
        }),
      },
    });
  }
  return hasil;
}

/**
 * Kategori yang tampil di toko (PRD §3.1), urut menurut nama: deret Kategori di Beranda dan isi tab
 * Kategori. Urutan nama ini keputusan teknis, karena PRD tidak mengaturnya.
 */
export async function daftarKategoriToko(): Promise<Kategori[]> {
  const [kategori, produkTampil] = await Promise.all([
    daftarKategori(),
    produkKatalog(),
  ]);
  return kategoriTampil({ kategori, produkTampil });
}

/**
 * Isi Beranda (PRD §3.6): deret Kategori, kartu Produk Unggulan, dan kartu semua Produk aktif yang
 * cocok dengan pencarian dan saringan Kategori. Bagian semua Produk juga memuat Produk Unggulan, dan
 * bagian Produk Unggulan tidak ikut disaring.
 *
 * Saringan Kategori hanya berlaku untuk Kategori yang tampil di toko; Kategori lain diabaikan, jadi
 * kategoriTerpilih null dan semua Produk ikut.
 */
export async function daftarProdukBeranda({
  kataCari = "",
  kategoriId = null,
}: { kataCari?: string; kategoriId?: string | null } = {}): Promise<{
  kategori: Kategori[];
  kategoriTerpilih: Kategori | null;
  unggulan: KartuProduk[];
  semua: KartuProduk[];
}> {
  const [semuaKategori, produkTampil] = await Promise.all([
    daftarKategori(),
    produkKatalog(),
  ]);
  const kategori = kategoriTampil({ kategori: semuaKategori, produkTampil });
  const kategoriTerpilih = kategori.find((k) => k.id === kategoriId) ?? null;

  return {
    kategori,
    kategoriTerpilih,
    unggulan: produkTampil.filter((p) => p.unggulan).map((p) => p.kartu),
    semua: saringProdukBeranda({
      produk: produkTampil,
      kataCari,
      kategoriId: kategoriTerpilih?.id ?? null,
    }).map((p) => p.kartu),
  };
}

/** Satu Varian aktif di Halaman Produk, beserta Stok Varian-nya. */
type VarianHalamanProduk = {
  id: string;
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  stokVarian: number;
  /** Stok Varian 0, jadi Varian ini tampil "Habis" dan tidak bisa dipilih. */
  habis: boolean;
  /** Persen hemat, atau null bila Varian ini tanpa Harga normal. */
  persenHemat: number | null;
};

/** Isi Halaman Produk (PRD §3.3). */
export type HalamanProduk = {
  id: string;
  nama: string;
  kategori: { id: string; nama: string };
  /** Alamat foto Produk menurut urutannya, paling banyak 5. */
  foto: string[];
  deskripsi: string;
  ketentuanGaransi: string;
  /** Pilihan Varian tampil karena Varian aktifnya lebih dari satu (PRD §3.2). */
  pilihanVarian: boolean;
  /** Varian aktif, urut dari Harga jual termurah, lalu nama. */
  varian: VarianHalamanProduk[];
};

/**
 * Isi Halaman Produk (PRD §3.3), atau null bila Produk itu tidak tampil di toko: Produk tidak ada,
 * nonaktif (PRD §3.7), atau tanpa Varian aktif (PRD §3.2 ▶ Keputusan 2026-11-11 #53).
 */
export async function bacaHalamanProduk(
  id: string,
): Promise<HalamanProduk | null> {
  const [[p], semuaVarian] = await Promise.all([
    db
      .select({
        nama: produk.nama,
        foto: produk.foto,
        deskripsi: produk.deskripsi,
        ketentuanGaransi: produk.ketentuanGaransi,
        kategori: { id: kategori.id, nama: kategori.nama },
      })
      .from(produk)
      .innerJoin(kategori, eq(produk.kategoriId, kategori.id))
      .where(and(eq(produk.id, id), eq(produk.aktif, true))),
    varianProdukAktif(id),
  ]);
  if (p === undefined) return null;

  const isi = varianHalamanProduk({ varian: semuaVarian });
  if (isi === null) return null;

  return {
    id,
    nama: p.nama,
    kategori: p.kategori,
    foto: p.foto.map(alamatBerkasUnggahan),
    deskripsi: p.deskripsi,
    ketentuanGaransi: p.ketentuanGaransi,
    pilihanVarian: isi.pilihanVarian,
    varian: isi.varian.map((v) => ({
      id: v.id,
      nama: v.nama,
      hargaJual: v.hargaJual,
      hargaNormal: v.hargaNormal,
      stokVarian: v.stokVarian,
      habis: v.habis,
      persenHemat: v.persenHemat,
    })),
  };
}
