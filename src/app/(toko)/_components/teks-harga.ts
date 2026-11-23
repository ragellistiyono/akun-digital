import { rupiah } from "@/lib/rupiah";

/**
 * Harga jual yang tampil di toko: "Rp X", atau "Gratis" sebagai gantinya untuk Varian Produk gratis, di kartu Produk,
 * Kartu Produk Unggulan, Halaman Produk, Pilihan Varian, dan tombol beli (PRD §16.4, DESIGN.md ▶ Keputusan
 * 2026-11-22). Ukuran, huruf, dan warnanya mengikuti tempat Harga jual yang digantikannya.
 */
export function teksHarga({
  hargaJual,
  gratis,
}: {
  hargaJual: number;
  gratis: boolean;
}) {
  return gratis ? "Gratis" : rupiah(hargaJual);
}
