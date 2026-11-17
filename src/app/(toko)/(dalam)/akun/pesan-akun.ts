import {
  BATAS_SALAH_PASSWORD_LAMA,
  LAMA_KUNCI_GANTI_PASSWORD_MENIT,
} from "@/domain/batas-ganti-password";
import { jamWibDibulatkanKeAtas } from "@/server/zona-waktu-toko";

// Keadaan form dan pesan ganti password di tab Akun (PRD §7.6 ▶ Keputusan 2026-11-17).

/** Keadaan form ganti password: pesan galat isian dan penolakan, atau kabar bahwa password sudah diganti. */
export type KeadaanFormGantiPassword = {
  galat?: { passwordLama?: string; passwordBaru?: string; umum?: string };
  berhasil?: string;
};

/** Penolakan password lama yang tidak cocok (PRD §7.6 ▶ Keputusan 2026-11-17). */
export const PESAN_PASSWORD_LAMA_SALAH =
  "Password lama salah, jadi password tidak diganti.";

/**
 * Penolakan selama ganti password dikunci, dengan jam ganti password boleh dicoba lagi dalam WIB
 * (PRD §7.6 ▶ Keputusan 2026-11-17).
 */
export function pesanGantiPasswordTerkunci(terkunciSampai: Date): string {
  const jam = jamWibDibulatkanKeAtas(terkunciSampai);
  return `Password lama salah ${BATAS_SALAH_PASSWORD_LAMA} kali berturut-turut, jadi ganti password dikunci ${LAMA_KUNCI_GANTI_PASSWORD_MENIT} menit. Coba lagi mulai pukul ${jam} WIB.`;
}

/** Kabar setelah password diganti (T46). */
export const PESAN_PASSWORD_SUDAH_DIGANTI = "Password sudah diganti.";
