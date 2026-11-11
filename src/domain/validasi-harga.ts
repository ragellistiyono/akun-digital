// Aturan Harga jual dan Harga normal sebuah Varian (PRD §3.2, §3.5).

/** Harga jual terkecil, dalam rupiah (PRD §3.2). */
export const HARGA_JUAL_MINIMUM = 1_000;

/**
 * Harga jual terbesar, dalam rupiah (PRD §3.2, ▶ Keputusan 2026-11-11), karena Qrispy hanya membuat
 * QRIS sampai Rp 499.000 untuk merchant standar.
 */
export const HARGA_JUAL_MAKSIMUM = 499_000;

export type AlasanHargaDitolak =
  | "harga-jual-kurang-dari-minimum"
  | "harga-jual-lebih-dari-maksimum"
  | "harga-jual-bukan-rupiah-bulat"
  | "harga-normal-tidak-lebih-besar"
  | "harga-normal-bukan-rupiah-bulat";

type HasilPeriksaHarga =
  { valid: true; alasan: null } | { valid: false; alasan: AlasanHargaDitolak };

const ditolak = (alasan: AlasanHargaDitolak): HasilPeriksaHarga => ({
  valid: false,
  alasan,
});

/**
 * Memeriksa Harga jual dan Harga normal sebuah Varian, dalam rupiah. Harga jual minimal Rp 1.000,
 * maksimal Rp 499.000, dan rupiah bulat tanpa sen. Harga normal opsional (null), dan bila diisi harus
 * rupiah bulat yang lebih besar dari Harga jual, tanpa batas maksimum karena hanya untuk tampilan.
 *
 * Hanya satu alasan yang dikembalikan. Harga jual diperiksa lebih dulu daripada Harga normal, dan di
 * setiap harga, batasnya diperiksa lebih dulu daripada sen.
 */
export function periksaHarga({
  hargaJual,
  hargaNormal,
}: {
  hargaJual: number;
  hargaNormal: number | null;
}): HasilPeriksaHarga {
  if (hargaJual < HARGA_JUAL_MINIMUM) {
    return ditolak("harga-jual-kurang-dari-minimum");
  }
  if (hargaJual > HARGA_JUAL_MAKSIMUM) {
    return ditolak("harga-jual-lebih-dari-maksimum");
  }
  if (!Number.isInteger(hargaJual)) {
    return ditolak("harga-jual-bukan-rupiah-bulat");
  }
  if (hargaNormal !== null) {
    if (hargaNormal <= hargaJual) {
      return ditolak("harga-normal-tidak-lebih-besar");
    }
    if (!Number.isInteger(hargaNormal)) {
      return ditolak("harga-normal-bukan-rupiah-bulat");
    }
  }
  return { valid: true, alasan: null };
}
