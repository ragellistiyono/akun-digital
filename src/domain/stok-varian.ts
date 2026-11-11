// Stok Varian (PRD §5.3).
import type { StatusItemStok } from "./item-stok";

/**
 * Stok Varian, yaitu jumlah Item stok Varian yang belum terkirim dan tidak sedang ditahan: jumlah
 * Item stok berstatus Tersedia (PRD §5.3). Hasilnya membawa jumlah Item stok per status sebagai bahan
 * hitungnya.
 */
export function stokVarian({
  jumlahPerStatus,
}: {
  jumlahPerStatus: Record<StatusItemStok, number>;
}) {
  return { stokVarian: jumlahPerStatus.Tersedia, jumlahPerStatus };
}
