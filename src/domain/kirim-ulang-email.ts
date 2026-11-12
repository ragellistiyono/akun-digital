// Kirim ulang email "Pesanan selesai" dan koreksi email Pesanan oleh Admin (PRD §6.4, §9.5).
import type { StatusPesanan } from "./status-pesanan";

/**
 * Apakah Admin bisa mengirim ulang email "Pesanan selesai" sebuah Pesanan (PRD §6.4). Email itu berisi
 * Item stok, jadi kirim ulang hanya tersedia untuk Pesanan Selesai; untuk status lain kirim ulang tidak
 * tersedia.
 */
export function kirimUlangEmailTersedia(statusPesanan: StatusPesanan) {
  return statusPesanan === "Selesai";
}

/**
 * Apakah Admin bisa mengoreksi email sebuah Pesanan (PRD §6.4, ▶ Keputusan 2026-11-12). Koreksi tersedia
 * untuk Pesanan Selesai, yang emailnya langsung dikirim ulang ke alamat baru (kirimUlangEmailTersedia), dan
 * untuk Pesanan Bermasalah, supaya alamatnya benar sebelum Admin menekan "Kirim Item stok"; untuk Pesanan
 * Bermasalah koreksi hanya menyimpan email baru. Untuk status lain koreksi tidak tersedia.
 */
export function koreksiEmailTersedia(statusPesanan: StatusPesanan) {
  return statusPesanan === "Selesai" || statusPesanan === "Bermasalah";
}
