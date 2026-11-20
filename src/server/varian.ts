// Varian sebuah Produk (PRD §3.2, §3.5, §3.7, §14.1). Aturan Harga jual dan Harga normal ada di
// src/domain/validasi-harga.ts, dan aturan Harga modal di src/domain/harga-modal.ts; keduanya diperiksa
// sebelum modul ini dipanggil. Aturan hapus Produk dan Varian ada di src/domain/hapus-katalog.ts.
import { and, asc, count, eq, isNull, type SQL } from "drizzle-orm";

import { bolehHapusProdukAtauVarian } from "@/domain/hapus-katalog";
import { hargaModalIsiPertama } from "@/domain/harga-modal";
import type { StatusPesanan } from "@/domain/status-pesanan";

import { db } from "./db";
import { itemStok, pesanan, produk, varian } from "./db/schema";

/**
 * Isian Varian yang diisi Admin, dengan harga dalam rupiah yang sudah diperiksa periksaHarga dan
 * periksaHargaModal.
 */
type IsianVarian = {
  nama: string;
  hargaJual: number;
  hargaNormal: number | null;
  hargaModal: number;
  aktif: boolean;
};

/**
 * Semua Varian sebuah Produk untuk dasbor admin, urut dari Harga jual termurah. Urutan ini keputusan
 * teknis, karena PRD tidak mengatur urutan Varian di dasbor admin. Harga modal null untuk Varian yang dibuat
 * sebelum fitur Harga modal tayang (PRD §14.1).
 */
export async function daftarVarian(produkId: string) {
  return db
    .select({
      id: varian.id,
      nama: varian.nama,
      hargaJual: varian.hargaJual,
      hargaNormal: varian.hargaNormal,
      hargaModal: varian.hargaModal,
      aktif: varian.aktif,
    })
    .from(varian)
    .where(eq(varian.produkId, produkId))
    .orderBy(asc(varian.hargaJual), asc(varian.nama), asc(varian.id));
}

/**
 * Satu Varian milik sebuah Produk beserta nama dan Format Item stok Produknya, untuk halaman Varian di
 * dasbor admin. Hasilnya null bila Varian tidak ada atau milik Produk lain.
 */
export async function bacaVarian({
  id,
  produkId,
}: {
  id: string;
  produkId: string;
}) {
  const [baris] = await db
    .select({
      id: varian.id,
      nama: varian.nama,
      produkId: produk.id,
      namaProduk: produk.nama,
      formatItemStok: produk.formatItemStok,
    })
    .from(varian)
    .innerJoin(produk, eq(varian.produkId, produk.id))
    .where(and(eq(varian.id, id), eq(varian.produkId, produkId)));
  return baris ?? null;
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
 *
 * Bila Harga modal Varian itu diisi untuk pertama kalinya, semua Pesanan Varian itu yang tercatat tanpa Harga
 * modal ikut memakai nilai itu, apa pun statusnya, dalam transaksi yang sama (PRD §14.1, hargaModalIsiPertama).
 * Baris Varian dikunci FOR NO KEY UPDATE lebih dulu, supaya Harga modal sebelumnya tidak berubah di tengah
 * jalan. Checkout membaca Harga modal Varian FOR SHARE di transaksinya (buatPesanan), jadi checkout yang
 * berjalan bersamaan menunggu transaksi ini lalu mencatat Harga modal baru, atau transaksi ini menunggu
 * checkout itu lalu ikut mengisi Pesanan barunya.
 */
export async function ubahVarian({
  id,
  produkId,
  ...isian
}: IsianVarian & { id: string; produkId: string }) {
  return db.transaction(async (tx) => {
    const [sebelumnya] = await tx
      .select({ hargaModal: varian.hargaModal })
      .from(varian)
      .where(and(eq(varian.id, id), eq(varian.produkId, produkId)))
      .for("no key update");
    if (!sebelumnya) return { hasil: "tidak-ada" } as const;

    await tx.update(varian).set(isian).where(eq(varian.id, id));
    const isiPertama = hargaModalIsiPertama({
      hargaModalSebelumnya: sebelumnya.hargaModal,
      hargaModalBaru: isian.hargaModal,
    });
    if (isiPertama !== null) {
      await tx
        .update(pesanan)
        .set({ hargaModal: isiPertama })
        .where(and(eq(pesanan.varianId, id), isNull(pesanan.hargaModal)));
    }
    return { hasil: "diubah" } as const;
  });
}

type Penghubung = Pick<typeof db, "select">;

/** Jumlah Pesanan per status yang mencatat Varian-Varian yang memenuhi `kondisi`. */
async function jumlahPesananPerStatus(tx: Penghubung, kondisi: SQL) {
  const jumlah: Partial<Record<StatusPesanan, number>> = {};
  const semua = await tx
    .select({ status: pesanan.status, jumlah: count() })
    .from(pesanan)
    .innerJoin(varian, eq(pesanan.varianId, varian.id))
    .where(kondisi)
    .groupBy(pesanan.status);
  for (const baris of semua) jumlah[baris.status] = baris.jumlah;
  return jumlah;
}

/**
 * Memeriksa apakah Varian-Varian yang memenuhi `kondisi`, yaitu satu Varian atau semua Varian sebuah Produk,
 * boleh dihapus menurut bolehHapusProdukAtauVarian (PRD §3.7). Pemanggilnya sudah mengunci baris Varian itu
 * FOR NO KEY UPDATE di transaksi yang sama, lalu menghapusnya bila boleh.
 *
 * Supaya Pesanan baru dari checkout yang sedang berjalan tidak terlewat, Item stok Varian itu dikunci FOR
 * UPDATE sebelum pemeriksaan terakhir:
 * - Checkout selalu mengunci satu Item stok Tersedia (FOR UPDATE SKIP LOCKED) sebelum menyimpan Pesanan, dan
 *   memegang kuncinya sampai Pesanan itu tersimpan. Jadi checkout yang lebih dulu mengunci Item stok membuat
 *   transaksi ini menunggu, lalu Pesanannya ikut terhitung. Checkout yang datang belakangan melewati Item
 *   stok yang sudah dikunci di sini, lalu ditolak karena stok habis.
 * - Item stok baru tidak bisa muncul di tengah jalan, karena pengisian Item stok mengunci baris Varian FOR
 *   UPDATE, yang menunggu kunci Varian transaksi ini.
 * - Checkout mengunci baris Varian FOR SHARE sebelum Item stok, untuk mencatat Harga modal-nya (PRD §14.1).
 *   Kunci itu bertabrakan dengan kunci Varian FOR NO KEY UPDATE transaksi ini, jadi checkout yang lebih dulu
 *   mengunci Varian membuat transaksi ini menunggu sampai Pesanannya tersimpan, dan checkout yang datang
 *   belakangan menunggu transaksi ini, lalu ditolak bila Varian-nya sudah terhapus. Karena keduanya mengunci
 *   Varian sebelum Item stok, keduanya tidak saling menunggu.
 *
 * Pemeriksaan pertama berjalan sebelum Item stok dikunci, supaya Produk atau Varian yang sudah pernah dipesan
 * langsung ditolak tanpa menghalangi checkout lain.
 */
export async function periksaHapusVarian(tx: Penghubung, kondisi: SQL) {
  const periksa = async () =>
    bolehHapusProdukAtauVarian({
      jumlahPesananPerStatus: await jumlahPesananPerStatus(tx, kondisi),
    });

  const sebelumDikunci = await periksa();
  if (!sebelumDikunci.boleh) return sebelumDikunci;
  await tx
    .select({ id: itemStok.id })
    .from(itemStok)
    .innerJoin(varian, eq(itemStok.varianId, varian.id))
    .where(kondisi)
    .for("update", { of: itemStok });
  return periksa();
}

/**
 * Menghapus Varian milik sebuah Produk beserta Item stok-nya (PRD §3.7). Varian yang sudah pernah dipesan,
 * yaitu tercatat di Pesanan berstatus apa pun, tidak dihapus, dan hasilnya membawa jumlah Pesanan itu. Item
 * stok ikut terhapus lewat foreign key-nya (ON DELETE CASCADE). Varian yang tidak ada, atau milik Produk
 * lain, tidak berubah.
 *
 * Baris Varian dikunci FOR NO KEY UPDATE lebih dulu, dengan urutan yang sama seperti pengisian dan pengubahan
 * Item stok, lalu Item stok-nya dikunci lewat periksaHapusVarian, supaya checkout yang sedang berjalan ikut
 * terhitung atau ditolak karena stok habis.
 */
export async function hapusVarian({
  id,
  produkId,
}: {
  id: string;
  produkId: string;
}) {
  return db.transaction(async (tx) => {
    const [terkunci] = await tx
      .select({ id: varian.id })
      .from(varian)
      .where(and(eq(varian.id, id), eq(varian.produkId, produkId)))
      .for("no key update");
    if (!terkunci) return { hasil: "tidak-ada" } as const;

    const boleh = await periksaHapusVarian(tx, eq(varian.id, id));
    if (!boleh.boleh) {
      return {
        hasil: "pernah-dipesan",
        jumlahPesanan: boleh.jumlahPesanan,
      } as const;
    }

    await tx.delete(varian).where(eq(varian.id, id));
    return { hasil: "dihapus" } as const;
  });
}
