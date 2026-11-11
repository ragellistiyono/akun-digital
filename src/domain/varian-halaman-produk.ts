// Daftar Varian di Halaman Produk (PRD §3.2–§3.5, §3.7).
import { persenHemat } from "./persen-hemat";
import { varianHabis } from "./stok-varian";

/** Bahan satu Varian: Harga jual, Harga normal, Stok Varian, dan aktif atau nonaktif. */
type VarianProduk = {
  hargaJual: number;
  hargaNormal: number | null;
  stokVarian: number;
  aktif: boolean;
};

/**
 * Varian yang tampil di Halaman Produk. Varian nonaktif tidak tampil (PRD §3.7). Pilihan Varian hanya
 * tampil bila Varian aktifnya lebih dari satu (PRD §3.2). Setiap Varian membawa tanda habis, yaitu
 * Stok Varian 0, sehingga tampil "Habis" dan tidak bisa dipilih (PRD §3.4), serta Persen hemat-nya
 * menurut persenHemat (PRD §3.5). Di Halaman Produk, "Habis" menggantikan "Stok N", bukan label
 * Hemat, jadi Varian habis tetap membawa Persen hemat.
 *
 * Hasilnya null bila Produk tidak punya Varian aktif, karena Produk itu tidak tampil di toko (PRD §3.2
 * ▶ Keputusan 2026-11-11 #53). Urutan Varian mengikuti masukan.
 */
export function varianHalamanProduk<V extends VarianProduk>({
  varian,
}: {
  varian: readonly V[];
}) {
  const varianAktif = varian.filter((v) => v.aktif);
  if (varianAktif.length === 0) return null;

  return {
    pilihanVarian: varianAktif.length > 1,
    varian: varianAktif.map((v) => ({
      ...v,
      habis: varianHabis(v.stokVarian),
      persenHemat: persenHemat(v).persenHemat,
    })),
  };
}
