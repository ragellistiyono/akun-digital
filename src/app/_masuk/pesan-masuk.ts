import {
  BATAS_SALAH_PASSWORD,
  LAMA_KUNCI_LOGIN_MENIT,
} from "@/domain/batas-login";
import { jamWibDibulatkanKeAtas } from "@/server/zona-waktu-toko";

/**
 * Keadaan form login Admin dan login Member: email yang diketik dan pesan galatnya. `nomorWhatsapp` diisi
 * hanya untuk Member nonaktif, supaya form menampilkan tombol WhatsApp di bawah pesannya (PRD §7.5).
 */
export type KeadaanFormMasuk = {
  email: string;
  galat?: { email?: string; password?: string; umum?: string };
  nomorWhatsapp?: string | null;
};

// Pesan penolakan login yang sama untuk login Admin dan login Member (PRD §2.2, §7.5 ▶ Keputusan
// 2026-11-17, §7.7).

/** Pesan untuk password salah, juga untuk email yang tidak terdaftar di halaman login itu. */
export const PESAN_PASSWORD_SALAH =
  "Email atau password salah. Periksa keduanya, lalu coba masuk lagi.";

/** Pesan untuk Member nonaktif yang memasukkan password benar (PRD §7.5 ▶ Keputusan 2026-11-17). */
export const PESAN_MEMBER_NONAKTIF =
  "Akun Member ini dinonaktifkan, jadi tidak bisa masuk. Hubungi kami di WhatsApp.";

/** Pesan kunci 15 menit, dengan jam login boleh dicoba lagi dalam WIB (PRD §7.7). */
export function pesanLoginTerkunci(terkunciSampai: Date): string {
  const jam = jamWibDibulatkanKeAtas(terkunciSampai);
  return `Password salah ${BATAS_SALAH_PASSWORD} kali berturut-turut, jadi login dengan email ini dikunci ${LAMA_KUNCI_LOGIN_MENIT} menit. Coba masuk lagi mulai pukul ${jam} WIB.`;
}
