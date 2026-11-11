// Harga di kartu Produk (PRD §3.4, §3.8).
import { varianHabis } from "./stok-varian";

/** Bahan hitung harga kartu dari satu Varian: Harga jual, Stok Varian, dan aktif atau nonaktif. */
type VarianKartu = { hargaJual: number; stokVarian: number; aktif: boolean };

type HasilHargaKartuProduk<V extends VarianKartu> = {
  /** Kata "Mulai" dipakai karena Varian aktifnya lebih dari satu. */
  mulai: boolean;
  /** Harga jual yang tampil di kartu. */
  harga: number;
  /** Semua Varian aktif habis, jadi kartu menampilkan label Habis. */
  habis: boolean;
  /** Varian sumber harga, tempat Harga normal yang dicoret dan Hemat diambil (docs/DESIGN.md). */
  sumber: V;
  /** Varian aktif yang menjadi bahan hitung, menurut urutan masukan. */
  varianAktif: V[];
};

const termurah = <V extends VarianKartu>(varian: V[]) =>
  varian.reduce((murah, v) => (v.hargaJual < murah.hargaJual ? v : murah));

/**
 * Harga di kartu Produk (PRD §3.8). Varian nonaktif diabaikan (PRD §3.7). Harganya adalah Harga jual
 * termurah di antara Varian aktif yang Stok Varian-nya lebih dari 0. Bila semua Varian aktif habis,
 * harganya termurah di antara semua Varian aktif dan kartu menampilkan label Habis (PRD §3.4). Kata
 * "Mulai" dipakai bila Varian aktif lebih dari satu, termasuk saat habis.
 *
 * Varian yang memberi harga itu menjadi sumber harga. Bila Harga jual termurahnya sama, Varian yang
 * lebih dulu di masukan yang dipilih. Hasilnya null bila Produk tidak punya Varian aktif, karena Produk
 * itu tidak tampil di katalog.
 */
export function hargaKartuProduk<V extends VarianKartu>({
  varian,
}: {
  varian: readonly V[];
}): HasilHargaKartuProduk<V> | null {
  const varianAktif = varian.filter((v) => v.aktif);
  if (varianAktif.length === 0) return null;

  const berstok = varianAktif.filter((v) => !varianHabis(v.stokVarian));
  const habis = berstok.length === 0;
  const sumber = termurah(habis ? varianAktif : berstok);
  return {
    mulai: varianAktif.length > 1,
    harga: sumber.hargaJual,
    habis,
    sumber,
    varianAktif,
  };
}
