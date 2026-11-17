import { z } from "zod";

import type { AlasanTautanTidakBerlaku } from "@/domain/tautan-atur-ulang-password";

// Bentuk dan pesan Tautan atur ulang password (PRD §7.5 ▶ Keputusan 2026-11-17).

/** Bagian acak Tautan atur ulang password di alamat halaman: 43 karakter base64url. */
export const TautanAturUlang = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Keadaan form password baru: pesan galat isiannya. */
export type KeadaanFormAturUlang = { galat?: string };

/** Penolakan tautan yang tidak berlaku lagi, menurut alasannya. */
export const PESAN_TAUTAN_TIDAK_BERLAKU: Record<
  AlasanTautanTidakBerlaku,
  string
> = {
  kedaluwarsa:
    "Tautan ini sudah kedaluwarsa, karena hanya berlaku 30 menit. Minta tautan baru di halaman Lupa password.",
  "sudah-dipakai":
    "Tautan ini sudah dipakai. Minta tautan baru di halaman Lupa password bila perlu mengganti password lagi.",
  diganti:
    "Tautan ini sudah diganti tautan yang lebih baru. Pakai tautan di email terakhir dari kami, atau minta tautan baru.",
  "member-nonaktif":
    "Akun Member ini dinonaktifkan, jadi password tidak bisa diganti. Hubungi kami di WhatsApp.",
};
