// Aturan isian Voucher selain kode di form dasbor admin (PRD §8.2, §8.4 ▶ Keputusan 2026-11-17).
// Kode diperiksa terpisah oleh periksaKodeVoucher.

/** Jenis potongan Voucher (PRD §8.2): nominal tetap dalam rupiah, atau persen dari Harga jual. */
export const JENIS_POTONGAN = ["nominal", "persen"] as const;
export type JenisPotongan = (typeof JENIS_POTONGAN)[number];

/** Persen terkecil dan terbesar untuk Voucher berjenis persen. */
const RENTANG_PERSEN = { minimum: 1, maksimum: 100 } as const;

/** Rupiah terkecil untuk nominal tetap, batas maksimum, dan minimal Harga jual. */
const RUPIAH_MINIMUM_VOUCHER = 1;

/** Jenis Cakupan voucher (PRD §8.4 ▶ Keputusan 2026-11-17): semua Produk, Produk tertentu, atau Kategori tertentu. */
export const JENIS_CAKUPAN = ["semua", "produk", "kategori"] as const;
export type JenisCakupan = (typeof JENIS_CAKUPAN)[number];

/**
 * Cakupan voucher (GLOSSARY): semua Produk, atau daftar Produk atau Kategori tertentu. Bentuk ini membuat
 * Produk dan Kategori tidak bisa dicampur dalam satu Voucher.
 */
export type CakupanVoucher =
  | { jenis: "semua" }
  | { jenis: Exclude<JenisCakupan, "semua">; daftar: readonly string[] };

/**
 * Isian Voucher selain kode. `null` di Kuota voucher dan Batas per email berarti tanpa batas, di batas
 * maksimum berarti tanpa batas, dan di minimal Harga jual, mulai, dan berakhir berarti tidak diisi.
 */
export type IsianVoucher = {
  jenisPotongan: JenisPotongan;
  nilai: number;
  batasMaksimum: number | null;
  kuotaVoucher: number | null;
  batasPerEmail: number | null;
  minimalHargaJual: number | null;
  mulai: Date | null;
  berakhir: Date | null;
  cakupan: CakupanVoucher;
};

export type GalatIsianVoucher =
  | "nilai-bukan-bilangan-bulat"
  | "nilai-kurang-dari-minimum"
  | "persen-di-luar-rentang"
  | "batas-maksimum-bukan-bilangan-bulat"
  | "batas-maksimum-kurang-dari-minimum"
  | "kuota-voucher-bukan-bilangan-bulat"
  | "kuota-voucher-kurang-dari-1"
  | "batas-per-email-bukan-bilangan-bulat"
  | "batas-per-email-kurang-dari-1"
  | "minimal-harga-jual-bukan-bilangan-bulat"
  | "minimal-harga-jual-kurang-dari-minimum"
  | "berakhir-tidak-setelah-mulai"
  | "cakupan-kosong";

/** Galat sebuah bilangan bulat dengan batas bawah, atau null bila sah. Bilangan bulat diperiksa lebih dulu. */
function galatBilanganBulat<G extends GalatIsianVoucher>(
  nilai: number,
  minimum: number,
  galat: { bukanBulat: G; kurang: G },
): G | null {
  if (!Number.isInteger(nilai)) return galat.bukanBulat;
  if (nilai < minimum) return galat.kurang;
  return null;
}

function galatNilai({ jenisPotongan, nilai }: IsianVoucher) {
  if (jenisPotongan === "nominal") {
    return galatBilanganBulat(nilai, RUPIAH_MINIMUM_VOUCHER, {
      bukanBulat: "nilai-bukan-bilangan-bulat",
      kurang: "nilai-kurang-dari-minimum",
    });
  }
  if (!Number.isInteger(nilai)) return "nilai-bukan-bilangan-bulat";
  if (nilai < RENTANG_PERSEN.minimum || nilai > RENTANG_PERSEN.maksimum) {
    return "persen-di-luar-rentang";
  }
  return null;
}

/**
 * Memeriksa isian Voucher selain kode. Nominal tetap, batas maksimum, dan minimal Harga jual berupa rupiah
 * bulat minimal Rp 1. Persen bilangan bulat 1–100. Kuota voucher dan Batas per email bilangan bulat
 * minimal 1. Batas maksimum hanya berlaku untuk jenis persen, jadi diabaikan untuk nominal tetap. Bila
 * waktu mulai dan berakhir sama-sama diisi, berakhir harus setelah mulai. Cakupan Produk atau Kategori
 * memuat setidaknya satu isi daftar.
 *
 * `galat` berisi semua isian yang tidak sah, berurutan menurut isian, dengan paling banyak satu galat per
 * isian.
 */
export function periksaIsianVoucher(isian: IsianVoucher): {
  sah: boolean;
  galat: GalatIsianVoucher[];
} {
  const galat = [
    galatNilai(isian),
    isian.jenisPotongan === "persen" && isian.batasMaksimum !== null
      ? galatBilanganBulat(isian.batasMaksimum, RUPIAH_MINIMUM_VOUCHER, {
          bukanBulat: "batas-maksimum-bukan-bilangan-bulat",
          kurang: "batas-maksimum-kurang-dari-minimum",
        })
      : null,
    isian.kuotaVoucher === null
      ? null
      : galatBilanganBulat(isian.kuotaVoucher, 1, {
          bukanBulat: "kuota-voucher-bukan-bilangan-bulat",
          kurang: "kuota-voucher-kurang-dari-1",
        }),
    isian.batasPerEmail === null
      ? null
      : galatBilanganBulat(isian.batasPerEmail, 1, {
          bukanBulat: "batas-per-email-bukan-bilangan-bulat",
          kurang: "batas-per-email-kurang-dari-1",
        }),
    isian.minimalHargaJual === null
      ? null
      : galatBilanganBulat(isian.minimalHargaJual, RUPIAH_MINIMUM_VOUCHER, {
          bukanBulat: "minimal-harga-jual-bukan-bilangan-bulat",
          kurang: "minimal-harga-jual-kurang-dari-minimum",
        }),
    isian.mulai !== null &&
    isian.berakhir !== null &&
    isian.berakhir.getTime() <= isian.mulai.getTime()
      ? "berakhir-tidak-setelah-mulai"
      : null,
    isian.cakupan.jenis !== "semua" && isian.cakupan.daftar.length === 0
      ? "cakupan-kosong"
      : null,
  ].filter((g): g is GalatIsianVoucher => g !== null);
  return { sah: galat.length === 0, galat };
}
