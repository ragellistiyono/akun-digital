// Keadaan form dan pesan halaman Daftar serta halaman verifikasi (PRD §7.2, §7.7).

/** Keadaan form Daftar: email yang diketik dan pesan galatnya. */
export type KeadaanFormDaftar = {
  email: string;
  galat?: { email?: string; password?: string; umum?: string };
};

/** Hasil tombol "Kirim ulang kode" terakhir, atau null sebelum tombol itu ditekan. */
export type KeadaanKirimUlang = {
  pesan: { jenis: "terkirim" | "galat"; teks: string } | null;
};

/** Penolakan email Member, aktif maupun nonaktif, dan email Admin (PRD §7.2 ▶ Keputusan 2026-11-17). */
export const PESAN_EMAIL_TERDAFTAR =
  "Email ini sudah terdaftar. Masuk dengan email ini, atau pakai Lupa password bila lupa password-nya.";

/** Penolakan Kode verifikasi baru sebelum jeda 60 detik habis (PRD §7.2 ▶ Keputusan 2026-11-17, §7.7). */
export function pesanTungguKode(tungguDetik: number) {
  return `Kode verifikasi baru bisa dikirim lagi dalam ${tungguDetik} detik.`;
}
