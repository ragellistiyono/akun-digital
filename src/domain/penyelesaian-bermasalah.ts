// Admin menyelesaikan Pesanan Bermasalah (PRD §5.7, §5.9). Perpindahan status yang boleh ada di
// src/domain/status-pesanan.ts.
import { perpindahanStatusPesanan, type StatusPesanan } from "./status-pesanan";

/**
 * Cara Admin menyelesaikan Pesanan Bermasalah (PRD §5.9):
 * - `kirim-item-stok`: satu Item stok Tersedia dari Varian yang sama dikirim, lalu Pesanan menjadi Selesai;
 * - `dana-dikembalikan`: uangnya sudah dikembalikan di luar sistem, lalu Pesanan menjadi Dana Dikembalikan.
 */
export const CARA_PENYELESAIAN = [
  "kirim-item-stok",
  "dana-dikembalikan",
] as const;

export type CaraPenyelesaian = (typeof CARA_PENYELESAIAN)[number];

/** Status tujuan setiap cara penyelesaian (PRD §5.7). */
const STATUS_TUJUAN: Record<CaraPenyelesaian, StatusPesanan> = {
  "kirim-item-stok": "Selesai",
  "dana-dikembalikan": "Dana Dikembalikan",
};

/**
 * Apakah Admin bisa menyelesaikan Pesanan berstatus itu (PRD §5.7, §5.9). Hanya Pesanan Bermasalah yang
 * diselesaikan Admin; untuk status lain, Kirim Item stok dan Tandai Dana Dikembalikan tidak tersedia.
 */
export function penyelesaianBermasalahTersedia(statusPesanan: StatusPesanan) {
  return statusPesanan === "Bermasalah";
}

/**
 * Hasil Admin menyelesaikan sebuah Pesanan dengan cara itu (PRD §5.7, §5.9).
 *
 * - Pesanan selain Bermasalah, atau yang perpindahannya ke status tujuan tidak boleh, tidak diubah.
 * - Kirim Item stok ditolak bila Stok Varian Pesanan itu 0, dan Pesanan tetap Bermasalah; Admin mengisi
 *   stok Varian itu dulu. Item stok dari Varian lain tidak dipakai, jadi hanya Stok Varian Pesanan itu
 *   yang dihitung.
 * - Selain itu Pesanan pindah ke status tujuannya. Hanya Kirim Item stok yang mengirim satu Item stok baru.
 */
export function hasilPenyelesaianBermasalah(
  bahan: { statusPesanan: StatusPesanan } & (
    | { cara: "kirim-item-stok"; stokVarian: number }
    | { cara: "dana-dikembalikan" }
  ),
):
  | { hasil: "tidak-tersedia" }
  | { hasil: "stok-habis" }
  | {
      hasil: "diselesaikan";
      statusBaru: StatusPesanan;
      kirimItemStok: boolean;
    } {
  const statusBaru = STATUS_TUJUAN[bahan.cara];
  if (
    !penyelesaianBermasalahTersedia(bahan.statusPesanan) ||
    !perpindahanStatusPesanan({ dari: bahan.statusPesanan, ke: statusBaru })
      .boleh
  ) {
    return { hasil: "tidak-tersedia" };
  }
  if (bahan.cara === "kirim-item-stok" && bahan.stokVarian <= 0) {
    return { hasil: "stok-habis" };
  }
  return {
    hasil: "diselesaikan",
    statusBaru,
    kirimItemStok: bahan.cara === "kirim-item-stok",
  };
}
