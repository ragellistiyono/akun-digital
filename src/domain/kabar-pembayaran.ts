// Hasil kabar pembayaran dari Qrispy (PRD §5.7, §5.9).
import type { StatusPesanan } from "./status-pesanan";

/**
 * Perubahan Item stok karena kabar pembayaran:
 * - `ditahan`: Item stok yang ditahan Pesanan itu dikirim;
 * - `baru`: satu Item stok Tersedia dari Varian yang sama diambil dan dikirim;
 * - `lepas`: Item stok yang ditahan Pesanan itu dilepas tanpa dikirim;
 * - `null`: tidak ada perubahan Item stok.
 */
type PerubahanItemStok = "ditahan" | "baru" | "lepas" | null;

/** Status Pesanan yang belum dibayar, sehingga kabar pembayaran mengubahnya (PRD §5.7, §5.9 butir 1). */
const BELUM_DIBAYAR: readonly StatusPesanan[] = [
  "Menunggu Pembayaran",
  "Kedaluwarsa",
  "Dibatalkan",
];

/**
 * Status baru Pesanan dan perubahan Item stok-nya karena kabar pembayaran (PRD §5.7, §5.9).
 *
 * - Pesanan yang sudah dibayar (Selesai, Bermasalah, Dana Dikembalikan) tidak berubah, sehingga kabar
 *   berulang tidak pernah memberi Pesanan Item stok kedua.
 * - Nominal diterima yang kurang dari Total bayar membuat Pesanan Bermasalah, dan Item stok yang
 *   ditahannya dilepas tanpa dikirim (§5.9 butir 2). Nominal yang sama atau lebih diproses biasa.
 * - Item stok yang ditahan Pesanan itu dikirim, dan Pesanan menjadi Selesai.
 * - Pesanan yang tidak menahan Item stok, misalnya karena sudah Kedaluwarsa atau Dibatalkan, mendapat
 *   satu Item stok Tersedia bila Stok Varian-nya masih ada; bila habis, Pesanan menjadi Bermasalah
 *   (§5.9 butir 1).
 */
export function hasilKabarPembayaran({
  statusPesanan,
  totalBayar,
  nominalDiterima,
  punyaItemStokDitahan,
  stokVarian,
}: {
  statusPesanan: StatusPesanan;
  totalBayar: number;
  nominalDiterima: number;
  punyaItemStokDitahan: boolean;
  stokVarian: number;
}): { statusBaru: StatusPesanan; itemStok: PerubahanItemStok } {
  if (!BELUM_DIBAYAR.includes(statusPesanan)) {
    return { statusBaru: statusPesanan, itemStok: null };
  }
  if (nominalDiterima < totalBayar) {
    return {
      statusBaru: "Bermasalah",
      itemStok: punyaItemStokDitahan ? "lepas" : null,
    };
  }
  if (punyaItemStokDitahan) {
    return { statusBaru: "Selesai", itemStok: "ditahan" };
  }
  if (stokVarian > 0) return { statusBaru: "Selesai", itemStok: "baru" };
  return { statusBaru: "Bermasalah", itemStok: null };
}
