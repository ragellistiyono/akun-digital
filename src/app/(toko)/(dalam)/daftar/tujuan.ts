// Tujuan setelah Kode verifikasi yang benar (PRD §7.3 ▶ Keputusan 2026-11-22). Tautan "Daftar" yang punya tujuan
// sendiri, misalnya tautan di pilihan Saldo pada Checkout Tamu (PRD §15.7), membuka halaman Daftar dengan tujuan itu
// di alamatnya. Tujuan dibawa form Daftar ke halaman verifikasi, lalu oleh isian Kode verifikasi dan "Kirim ulang
// kode", supaya tetap berlaku setelah kode baru diminta atau kode salah dimasukkan. Tujuan datang dari URL, jadi
// hanya alamat di dalam toko yang dipakai, sama seperti alamat kembali halaman Masuk.

import { alamatKembaliAman } from "../masuk/alamat-kembali";

/** Nama parameter tujuan di alamat halaman Daftar dan halaman verifikasi, dan di form keduanya. */
export const PARAMETER_TUJUAN = "tujuan";

/** Tujuan Member baru tanpa tujuan yang sah: Riwayat Pesanan (PRD §7.3 ▶ Keputusan 2026-11-17). */
export const TUJUAN_SETELAH_VERIFIKASI = "/riwayat";

/** Tujuan yang aman, atau null bila `nilai` tidak ada atau bukan alamat di dalam toko. */
export function tujuanAman(nilai: unknown) {
  return alamatKembaliAman(nilai);
}

/** Alamat halaman Daftar atau halaman verifikasi itu, dengan tujuan bila ada. */
export function denganTujuan(alamat: string, tujuan: string | null) {
  return tujuan === null
    ? alamat
    : `${alamat}?${new URLSearchParams({ [PARAMETER_TUJUAN]: tujuan })}`;
}
