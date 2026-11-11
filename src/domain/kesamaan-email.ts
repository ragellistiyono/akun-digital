/**
 * Bentuk baku sebuah email (PRD §7.4): tanpa spasi di awal atau akhir, dan huruf kecil semua.
 * Dua email dianggap sama bila bentuk bakunya sama. Tidak ada aturan lain, misalnya titik di Gmail.
 */
export function emailBaku(email: string): string {
  return email.trim().toLowerCase();
}
