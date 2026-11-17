// Keadaan form dan pesan halaman Lupa password (PRD §7.5 ▶ Keputusan 2026-11-17).

/** Keadaan form Lupa password: email yang diketik, lalu pesan terkirim atau galat isiannya. */
export type KeadaanFormLupaPassword = {
  email: string;
  pesan?: string;
  galat?: string;
};

/** Pesan yang sama untuk setiap email yang sah, terdaftar atau tidak, supaya tidak membocorkan Member. */
export const PESAN_TAUTAN_TERKIRIM =
  "Bila email ini terdaftar sebagai Member, tautan atur ulang password sudah kami kirim. Periksa juga folder spam.";
