// Kirim ulang email "Pesanan selesai" oleh Admin (PRD §6.4, §9.5).
import type { StatusPesanan } from "./status-pesanan";

/**
 * Apakah Admin bisa mengirim ulang email "Pesanan selesai" sebuah Pesanan (PRD §6.4). Email itu berisi
 * Item stok, jadi kirim ulang hanya tersedia untuk Pesanan Selesai; untuk status lain kirim ulang tidak
 * tersedia.
 */
export function kirimUlangEmailTersedia(statusPesanan: StatusPesanan) {
  return statusPesanan === "Selesai";
}
