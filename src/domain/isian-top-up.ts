// Isian Nominal top up di Halaman Top up (PRD §15.3).
import { rupiahDariTeks } from "./rupiah";

/** Nominal top up terkecil, dalam rupiah (PRD §15.3). */
export const NOMINAL_TOP_UP_MINIMAL = 10_000;

/** Nominal top up terbesar, dalam rupiah: batas QRIS Qrispy untuk merchant standar (PRD §15.3). */
export const NOMINAL_TOP_UP_MAKSIMAL = 499_000;

export type AlasanIsianTopUp =
  "kosong" | "bukan-rupiah-bulat" | "di-bawah-minimal" | "di-atas-maksimal";

/**
 * Memeriksa isian Nominal top up (PRD §15.3, tests/golden/isian-top-up.json). `nominal` adalah teks isian apa adanya;
 * spasi di awal dan akhir dibuang, dan angka boleh ditulis seperti isian rupiah lain, misalnya "50.000". Isian
 * kosong, bukan angka, negatif, atau bersen ditolak sebelum batasnya diperiksa. Bila sah, `nominalTersimpan` adalah
 * Nominal top up yang dipakai.
 */
export function periksaIsianTopUp({ nominal }: { nominal: string }): {
  valid: boolean;
  alasan: AlasanIsianTopUp | null;
  nominalTersimpan: number | null;
} {
  const ditolak = (alasan: AlasanIsianTopUp) => ({
    valid: false,
    alasan,
    nominalTersimpan: null,
  });
  const bersih = nominal.trim();
  if (bersih === "") return ditolak("kosong");
  const nilai = rupiahDariTeks(bersih);
  if (nilai === null || !Number.isInteger(nilai)) {
    return ditolak("bukan-rupiah-bulat");
  }
  if (nilai < NOMINAL_TOP_UP_MINIMAL) return ditolak("di-bawah-minimal");
  if (nilai > NOMINAL_TOP_UP_MAKSIMAL) return ditolak("di-atas-maksimal");
  return { valid: true, alasan: null, nominalTersimpan: nilai };
}
