// Jeda kirim ulang Kode verifikasi (PRD §7.7), yang juga berlaku untuk pendaftaran ulang Pendaftar
// (PRD §7.2 ▶ Keputusan 2026-11-17).

/** Jeda terpendek antara dua Kode verifikasi untuk satu email, dalam detik (PRD §7.7). */
const JEDA_KIRIM_ULANG_KODE_DETIK = 60;

const SATU_DETIK_MS = 1000;

/**
 * Apakah Kode verifikasi baru boleh dikirim sekarang. Kode baru boleh dikirim paling cepat 60 detik
 * setelah kode sebelumnya dikirim; tepat 60 detik sesudahnya sudah boleh. Bila belum boleh,
 * `tungguDetik` adalah sisa detik sebelum boleh, dibulatkan ke atas supaya tidak pernah terlalu kecil.
 */
export function periksaKirimUlangKodeVerifikasi({
  terakhirDikirimPada,
  sekarang,
}: {
  terakhirDikirimPada: Date;
  sekarang: Date;
}): { boleh: boolean; tungguDetik: number } {
  const bolehPada =
    terakhirDikirimPada.getTime() + JEDA_KIRIM_ULANG_KODE_DETIK * SATU_DETIK_MS;
  const tungguDetik = Math.max(
    0,
    Math.ceil((bolehPada - sekarang.getTime()) / SATU_DETIK_MS),
  );
  return { boleh: tungguDetik === 0, tungguDetik };
}
