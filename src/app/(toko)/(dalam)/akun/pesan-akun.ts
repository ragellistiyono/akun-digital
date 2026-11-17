// Keadaan form dan pesan ganti password di tab Akun (PRD §7.6 ▶ Keputusan 2026-11-17).

/** Keadaan form ganti password: pesan galat isian dan penolakan, atau kabar bahwa password sudah diganti. */
export type KeadaanFormGantiPassword = {
  galat?: { passwordLama?: string; passwordBaru?: string; umum?: string };
  berhasil?: string;
};

/** Penolakan password lama yang tidak cocok (PRD §7.6 ▶ Keputusan 2026-11-17). */
export const PESAN_PASSWORD_LAMA_SALAH =
  "Password lama salah, jadi password tidak diganti.";

/** Kabar setelah password diganti (T46). */
export const PESAN_PASSWORD_SUDAH_DIGANTI = "Password sudah diganti.";
