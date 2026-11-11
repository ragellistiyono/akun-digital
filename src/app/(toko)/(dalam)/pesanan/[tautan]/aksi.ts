"use server";

import { redirect, RedirectType } from "next/navigation";

import { batalkanPesanan } from "@/server/pembatalan-pesanan";
import { TautanPesanan } from "@/server/pesanan";

export type KeadaanPembatalan = { galat?: string };

const PESAN_TAUTAN_TIDAK_DIKENAL =
  "Tautan Pesanan ini tidak dikenal, jadi tidak ada Pesanan yang dibatalkan. Buka lagi Pesanan Anda lewat Tautan Pesanan-nya, lalu tekan Batalkan.";

const PESAN_GAGAL =
  "Pesanan belum bisa dibatalkan karena Qrispy belum membatalkan QRIS-nya, jadi Pesanan masih Menunggu Pembayaran. Tekan Batalkan sekali lagi untuk mencoba lagi.";

/**
 * Tombol "Batalkan" di Halaman bayar (PRD §5.6, §5.8): Pembeli membatalkan Pesanan di Tautan Pesanan itu.
 * Setelah Pesanan Dibatalkan, diproses sebagai sudah dibayar, atau ternyata sudah tidak Menunggu
 * Pembayaran, halaman di Tautan Pesanan itu dibuka lagi dengan status terbarunya. Bila pembatalannya
 * gagal, Pembeli melihat pesan gagal dan Pesanan tetap Menunggu Pembayaran.
 */
export async function aksiBatalkanPesanan(
  _sebelumnya: KeadaanPembatalan,
  formData: FormData,
): Promise<KeadaanPembatalan> {
  // Pembatalan terbuka untuk Tamu (PRD §6.2), jadi tidak ada sesi yang dibaca. Kewenangannya adalah
  // memegang Tautan Pesanan: hanya Pesanan dengan Tautan Pesanan itu yang bisa dibatalkan.
  const tautan = TautanPesanan.safeParse(formData.get("tautan"));
  if (!tautan.success) return { galat: PESAN_TAUTAN_TIDAK_DIKENAL };

  const { hasil } = await batalkanPesanan(tautan.data);
  if (hasil === "tidak-ditemukan") return { galat: PESAN_TAUTAN_TIDAK_DIKENAL };
  if (hasil === "gagal") return { galat: PESAN_GAGAL };
  // Halaman yang sama dibuat ulang di server tanpa menambah riwayat browser.
  redirect(`/pesanan/${tautan.data}`, RedirectType.replace);
}
