// Hasil kabar pembayaran dari Qrispy untuk Top up (PRD §15.4, §15.5).
import { biayaTransaksi } from "./biaya-transaksi";
import type { StatusTopUp } from "./status-top-up";

/**
 * Status Top up yang belum dibayar, sehingga kabar pembayaran mengubahnya (PRD §15.4, §15.5 butir 3). Top up
 * Kedaluwarsa dan Dibatalkan tetap diproses, karena kabarnya bisa datang terlambat.
 */
const BELUM_DIBAYAR: readonly StatusTopUp[] = [
  "Menunggu Pembayaran",
  "Kedaluwarsa",
  "Dibatalkan",
];

/**
 * Hasil kabar pembayaran untuk Top up (PRD §15.4, §15.5).
 *
 * - Top up yang sudah dibayar (Berhasil, Bermasalah, Dana Dikembalikan) tidak berubah: `statusBaru` null, saldo
 *   tidak bertambah, dan tidak ada Biaya transaksi yang dicatat. Karena itu kabar berulang tidak pernah menambah
 *   saldo dua kali.
 * - Nominal diterima yang sama dengan atau lebih dari Total bayar membuat Top up Berhasil, dan saldo bertambah sebesar
 *   Nominal top up. Kelebihan bayar tidak ditambahkan.
 * - Nominal diterima yang kurang membuat Top up Bermasalah, dan saldo tidak berubah.
 * - Top up Kedaluwarsa dan Dibatalkan diproses dengan aturan yang sama, karena Top up tidak bergantung pada stok.
 * - Biaya transaksi dihitung dari Total bayar dengan rumus Pesanan (PRD §14.3), juga untuk Top up yang menjadi
 *   Bermasalah.
 */
export function hasilKabarPembayaranTopUp({
  statusTopUp,
  nominalTopUp,
  totalBayar,
  nominalDiterima,
  persenBiayaTransaksi,
  minimalTotalBayarBiayaTransaksi,
}: {
  statusTopUp: StatusTopUp;
  nominalTopUp: number;
  totalBayar: number;
  nominalDiterima: number;
  persenBiayaTransaksi: number;
  minimalTotalBayarBiayaTransaksi: number;
}): {
  statusBaru: StatusTopUp | null;
  saldoBertambah: number;
  biayaTransaksi: number | null;
} {
  if (!BELUM_DIBAYAR.includes(statusTopUp)) {
    return { statusBaru: null, saldoBertambah: 0, biayaTransaksi: null };
  }
  const biaya = biayaTransaksi({
    totalBayar,
    persen: persenBiayaTransaksi,
    minimalTotalBayar: minimalTotalBayarBiayaTransaksi,
  }).biayaTransaksi;
  if (nominalDiterima < totalBayar) {
    return {
      statusBaru: "Bermasalah",
      saldoBertambah: 0,
      biayaTransaksi: biaya,
    };
  }
  return {
    statusBaru: "Berhasil",
    saldoBertambah: nominalTopUp,
    biayaTransaksi: biaya,
  };
}
