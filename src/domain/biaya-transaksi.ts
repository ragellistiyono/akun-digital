// Biaya transaksi sebuah Pesanan dan isiannya di Pengaturan toko (PRD §9.8, §14.3).

/** Nilai awal persen biaya transaksi (PRD §14.3). */
export const PERSEN_BIAYA_TRANSAKSI_AWAL = 0.7;

/** Nilai awal minimal Total bayar yang dikenai biaya, dalam rupiah (PRD §14.3). */
export const MINIMAL_TOTAL_BAYAR_BIAYA_TRANSAKSI_AWAL = 100_000;

/** Persen biaya transaksi terbesar (PRD §14.3). */
export const PERSEN_BIAYA_TRANSAKSI_MAKSIMUM = 10;

/** Persen dikalikan 100 supaya hitungannya memakai bilangan bulat, misalnya 0,7 menjadi 70. */
const SKALA_PERSEN = 100;

/**
 * Persen sebagai bilangan bulat per 10.000, misalnya 0,7 menjadi 70. Persen yang sah punya paling banyak 2
 * angka di belakang koma, jadi pembulatan ini hanya membuang galat pecahan biner seperti 0,7 × 100 =
 * 70,00000000000001.
 */
const persenBulat = (persen: number) => Math.round(persen * SKALA_PERSEN);

/**
 * Biaya transaksi sebuah Pesanan (PRD §14.3): bila Total bayar sama dengan atau lebih dari minimal, Total bayar ×
 * persen ÷ 100 dibulatkan ke atas ke rupiah; bila kurang, Rp 0. Dihitung dengan bilangan bulat, supaya
 * 100.000 × 0,7% tepat Rp 700 dan tidak terbulatkan ke atas menjadi Rp 701 (tests/golden/biaya-transaksi.json).
 * Hasilnya membawa bahan hitungnya.
 */
export function biayaTransaksi({
  totalBayar,
  persen,
  minimalTotalBayar,
}: {
  totalBayar: number;
  persen: number;
  minimalTotalBayar: number;
}) {
  const pembagi = 100 * SKALA_PERSEN;
  const biaya =
    totalBayar < minimalTotalBayar
      ? 0
      : Math.ceil((totalBayar * persenBulat(persen)) / pembagi);
  return { totalBayar, persen, minimalTotalBayar, biayaTransaksi: biaya };
}

export type AlasanPersenBiayaTransaksiDitolak =
  "persen-kosong" | "persen-di-luar-rentang" | "persen-lebih-dari-2-desimal";

export type AlasanMinimalBiayaTransaksiDitolak =
  "minimal-kosong" | "minimal-negatif" | "minimal-bukan-rupiah-bulat";

function alasanPersen(
  persen: number | null,
): AlasanPersenBiayaTransaksiDitolak | null {
  if (persen === null) return "persen-kosong";
  if (persen < 0 || persen > PERSEN_BIAYA_TRANSAKSI_MAKSIMUM) {
    return "persen-di-luar-rentang";
  }
  // Galat pecahan biner, misalnya 0,07 × 100 = 7,000000000000001, tidak dihitung sebagai angka ketiga.
  if (Math.abs(persenBulat(persen) - persen * SKALA_PERSEN) > 1e-6) {
    return "persen-lebih-dari-2-desimal";
  }
  return null;
}

function alasanMinimal(
  minimal: number | null,
): AlasanMinimalBiayaTransaksiDitolak | null {
  if (minimal === null) return "minimal-kosong";
  if (minimal < 0) return "minimal-negatif";
  if (!Number.isInteger(minimal)) return "minimal-bukan-rupiah-bulat";
  return null;
}

/**
 * Memeriksa dua isian Biaya transaksi di Pengaturan toko (PRD §9.8, §14.3): persen 0 sampai 10 dengan paling
 * banyak 2 angka di belakang koma, dan minimal Total bayar rupiah bulat minimal Rp 0. Null berarti isiannya
 * kosong. Setiap isian diperiksa sendiri, jadi alasan keduanya bisa muncul bersamaan.
 */
export function periksaIsianBiayaTransaksi({
  persen,
  minimalTotalBayar,
}: {
  persen: number | null;
  minimalTotalBayar: number | null;
}) {
  const persenDitolak = alasanPersen(persen);
  const minimalDitolak = alasanMinimal(minimalTotalBayar);
  return {
    valid: persenDitolak === null && minimalDitolak === null,
    alasanPersen: persenDitolak,
    alasanMinimal: minimalDitolak,
  };
}
