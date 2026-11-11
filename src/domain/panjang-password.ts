// Aturan panjang password (PRD §7.5), yang juga berlaku untuk password Admin (PRD §2.2,
// ▶ Keputusan 2026-11-11 #53).

/** Jumlah karakter terkecil sebuah password (PRD §7.5). */
export const PANJANG_PASSWORD_MINIMUM = 8;

/**
 * Memeriksa apakah password cukup panjang: minimal 8 karakter. Setiap karakter dihitung satu,
 * termasuk spasi, dan password tidak dipangkas lebih dulu karena disimpan persis seperti diketik.
 */
export function periksaPanjangPassword(password: string): { valid: boolean } {
  return { valid: Array.from(password).length >= PANJANG_PASSWORD_MINIMUM };
}
