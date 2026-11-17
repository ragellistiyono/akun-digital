// Jumlah Pesanan Selesai di Ringkasan dasbor admin (PRD §9.2 ▶ Keputusan 2026-11-17).
import { pesananSelesaiDibayar } from "./pendapatan";
import type { RentangWaktu } from "./rentang-waktu-toko";
import type { StatusPesanan } from "./status-pesanan";

/**
 * Jumlah Pesanan Selesai yang dibayar dalam rentang itu, menurut waktu pembayaran seperti Pendapatan (PRD §9.2
 * ▶ Keputusan 2026-11-17). Pesanan Bermasalah yang kemudian diselesaikan Admin dihitung pada tanggal
 * pembayarannya. Hasilnya membawa rentang dan Pesanan yang dihitung sebagai bahan hitungnya.
 */
export function jumlahPesananSelesai<
  P extends { status: StatusPesanan; dibayarPada: Date | null },
>({ rentang, pesanan }: { rentang: RentangWaktu; pesanan: readonly P[] }) {
  const dihitung = pesananSelesaiDibayar({ rentang, pesanan });
  return { jumlah: dihitung.length, rentang, dihitung };
}
