// Alamat kembali setelah login Member (PRD §7.5 ▶ Keputusan 2026-11-17). Tautan Masuk di pesan Voucher khusus
// Member membawa alamat Checkout Varian itu, supaya Member kembali ke sana setelah login (PRD §8.7 ▶ Keputusan
// 2026-11-17). Alamat ini datang dari URL, jadi hanya alamat di dalam toko yang dipakai.

/** Nama parameter alamat kembali di alamat halaman Masuk dan di form login Member. */
export const PARAMETER_ALAMAT_KEMBALI = "kembali";

/** Tujuan login Member tanpa alamat kembali yang sah: Riwayat Pesanan. */
export const TUJUAN_SETELAH_MASUK = "/riwayat";

/** Asal semu untuk mengurai alamat relatif. Alamat yang asalnya berubah setelah diurai menunjuk ke luar toko. */
const ASAL_TOKO = "http://toko.invalid";

/**
 * Alamat kembali yang aman, atau null bila `nilai` bukan alamat di dalam toko. Yang diterima hanya path yang
 * diawali satu "/", misalnya "/checkout?varianId=…". Alamat lengkap ("https://…"), alamat tanpa skema ("//…" atau
 * "/\…"), skema lain ("javascript:…"), dan path relatif ditolak.
 */
export function alamatKembaliAman(nilai: unknown): string | null {
  if (typeof nilai !== "string" || !/^\/(?![/\\])/.test(nilai)) return null;
  // Karakter kontrol dan garis miring terbalik bisa dibaca browser sebagai bagian awal alamat lain.
  if (/[\\\u0000-\u001f\u007f]/.test(nilai)) return null;
  const alamat = new URL(nilai, ASAL_TOKO);
  if (alamat.origin !== ASAL_TOKO) return null;
  return `${alamat.pathname}${alamat.search}${alamat.hash}`;
}
