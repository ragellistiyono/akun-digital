// Kartu Item stok Tersedia dan Item stok Terkirim di Ringkasan dasbor admin (PRD §9.2 ▶ Keputusan 2026-11-20).
import type { StatusItemStok } from "./item-stok";

/** Jumlah Item stok satu Varian dengan satu status, beserta status aktif Varian dan Produk-nya. */
type KelompokItemStok = {
  status: StatusItemStok;
  varianAktif: boolean;
  produkAktif: boolean;
  jumlah: number;
};

const jumlahkan = (kelompok: readonly KelompokItemStok[]) =>
  kelompok.reduce((jumlah, k) => jumlah + k.jumlah, 0);

/**
 * Jumlah Item stok Tersedia di Varian aktif dari Produk aktif, yaitu Item stok yang bisa dibeli sekarang. Item
 * stok Ditahan tidak dihitung, begitu juga Item stok di Varian atau Produk nonaktif. Hasilnya membawa kelompok
 * yang dihitung sebagai bahan hitungnya.
 */
export function jumlahItemStokTersedia<K extends KelompokItemStok>({
  kelompok,
}: {
  kelompok: readonly K[];
}) {
  const dihitung = kelompok.filter(
    (k) => k.status === "Tersedia" && k.varianAktif && k.produkAktif,
  );
  return { jumlah: jumlahkan(dihitung), dihitung };
}

/**
 * Jumlah semua Item stok Terkirim sepanjang waktu, termasuk di Varian dan Produk nonaktif. Hasilnya membawa
 * kelompok yang dihitung sebagai bahan hitungnya.
 */
export function jumlahItemStokTerkirim<K extends KelompokItemStok>({
  kelompok,
}: {
  kelompok: readonly K[];
}) {
  const dihitung = kelompok.filter((k) => k.status === "Terkirim");
  return { jumlah: jumlahkan(dihitung), dihitung };
}
