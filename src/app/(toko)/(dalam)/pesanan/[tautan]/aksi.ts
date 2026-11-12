"use server";

import { redirect, RedirectType } from "next/navigation";

import { batalkanPesanan } from "@/server/pembatalan-pesanan";
import { TautanPesanan } from "@/server/pesanan";

import { TANDA_SUDAH_DIBAYAR } from "./_components/tanda-sudah-dibayar";

export type KeadaanPembatalan = { galat?: string };

const PESAN_TAUTAN_TIDAK_DIKENAL =
  "Tautan Pesanan ini tidak dikenal, jadi tidak ada Pesanan yang dibatalkan. Buka lagi Pesanan Anda lewat Tautan Pesanan-nya, lalu tekan Batalkan.";

const PESAN_GAGAL =
  "Pesanan belum bisa dibatalkan karena Qrispy belum membatalkan QRIS-nya, jadi Pesanan masih Menunggu Pembayaran. Tekan Batalkan sekali lagi untuk mencoba lagi.";

/**
 * Tombol "Batalkan" di Halaman bayar (PRD §5.6, §5.8): Pembeli membatalkan Pesanan di Tautan Pesanan itu.
 * Setelah Pesanan Dibatalkan, diproses sebagai sudah dibayar, atau ternyata sudah tidak Menunggu
 * Pembayaran, halaman di Tautan Pesanan itu dibuka lagi dengan status terbarunya. Pesanan yang diproses
 * sebagai sudah dibayar, atau yang sudah Selesai saat pembatalannya diproses, dibuka dengan tanda di
 * alamatnya, supaya Halaman Pesanan Selesai menjelaskan kenapa Pesanan tidak dibatalkan (▶ Keputusan
 * 2026-11-12 #87 dan #99). Bila pembatalannya gagal, Pembeli melihat pesan gagal dan Pesanan tetap
 * Menunggu Pembayaran.
 */
export async function aksiBatalkanPesanan(
  _sebelumnya: KeadaanPembatalan,
  formData: FormData,
): Promise<KeadaanPembatalan> {
  // Pembatalan terbuka untuk Tamu (PRD §6.2), jadi tidak ada sesi yang dibaca. Kewenangannya adalah
  // memegang Tautan Pesanan: hanya Pesanan dengan Tautan Pesanan itu yang bisa dibatalkan.
  const tautan = TautanPesanan.safeParse(formData.get("tautan"));
  if (!tautan.success) return { galat: PESAN_TAUTAN_TIDAK_DIKENAL };

  const pembatalan = await batalkanPesanan(tautan.data);
  if (pembatalan.hasil === "tidak-ditemukan") {
    return { galat: PESAN_TAUTAN_TIDAK_DIKENAL };
  }
  if (pembatalan.hasil === "gagal") return { galat: PESAN_GAGAL };
  // Halaman yang sama dibuat ulang di server tanpa menambah riwayat browser.
  const sudahDibayar =
    pembatalan.hasil === "diproses-sebagai-dibayar" ||
    (pembatalan.hasil === "tidak-bisa-dibatalkan" &&
      pembatalan.status === "Selesai");
  const tanda = sudahDibayar
    ? `?${TANDA_SUDAH_DIBAYAR.nama}=${TANDA_SUDAH_DIBAYAR.nilai}`
    : "";
  redirect(`/pesanan/${tautan.data}${tanda}`, RedirectType.replace);
}
