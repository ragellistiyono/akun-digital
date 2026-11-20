// Isian dan total Biaya operasional (PRD §14.4).

/** Panjang keterangan terpanjang, setelah spasi di awal dan akhir dibuang (PRD §14.4). */
export const PANJANG_KETERANGAN_MAKSIMUM = 100;

/** Nominal terkecil, dalam rupiah (PRD §14.4). */
export const NOMINAL_MINIMUM = 1;

export type AlasanTanggalDitolak =
  "tanggal-kosong" | "tanggal-setelah-hari-ini";

export type AlasanKeteranganDitolak =
  "keterangan-kosong" | "keterangan-terlalu-panjang";

export type AlasanNominalDitolak =
  | "nominal-kosong"
  | "nominal-kurang-dari-minimum"
  | "nominal-bukan-rupiah-bulat";

/**
 * Panjang teks dalam karakter yang terlihat. Array.from menghitung per titik kode, jadi huruf di luar BMP, misalnya
 * emoji, dihitung satu karakter, bukan dua seperti String.length.
 */
const panjang = (teks: string) => Array.from(teks).length;

function alasanTanggal(
  tanggal: string | null,
  hariIni: string,
): AlasanTanggalDitolak | null {
  if (tanggal === null) return "tanggal-kosong";
  // Tanggal "YYYY-MM-DD" berurutan sama seperti teksnya, jadi bisa dibandingkan langsung.
  if (tanggal > hariIni) return "tanggal-setelah-hari-ini";
  return null;
}

function alasanKeterangan(keterangan: string): AlasanKeteranganDitolak | null {
  if (keterangan === "") return "keterangan-kosong";
  if (panjang(keterangan) > PANJANG_KETERANGAN_MAKSIMUM) {
    return "keterangan-terlalu-panjang";
  }
  return null;
}

function alasanNominal(nominal: number | null): AlasanNominalDitolak | null {
  if (nominal === null) return "nominal-kosong";
  if (nominal < NOMINAL_MINIMUM) return "nominal-kurang-dari-minimum";
  if (!Number.isInteger(nominal)) return "nominal-bukan-rupiah-bulat";
  return null;
}

/**
 * Memeriksa isian Biaya operasional (PRD §14.4, tests/golden/isian-biaya-operasional.json). `hariIni` dan `tanggal`
 * adalah tanggal "YYYY-MM-DD" dalam zona waktu toko (PRD §9.1); tanggal yang akan datang ditolak. Keterangan wajib
 * dan paling banyak 100 karakter setelah spasi di awal dan akhir dibuang. Nominal rupiah bulat minimal Rp 1. Null
 * berarti isiannya kosong. Setiap isian diperiksa sendiri, jadi beberapa alasan bisa muncul bersamaan.
 * `keteranganTersimpan` adalah keterangan yang disimpan bila semua isian sah.
 */
export function periksaIsianBiayaOperasional({
  hariIni,
  tanggal,
  keterangan,
  nominal,
}: {
  hariIni: string;
  tanggal: string | null;
  keterangan: string;
  nominal: number | null;
}) {
  const bersih = keterangan.trim();
  const tanggalDitolak = alasanTanggal(tanggal, hariIni);
  const keteranganDitolak = alasanKeterangan(bersih);
  const nominalDitolak = alasanNominal(nominal);
  const valid =
    tanggalDitolak === null &&
    keteranganDitolak === null &&
    nominalDitolak === null;
  return {
    valid,
    alasanTanggal: tanggalDitolak,
    alasanKeterangan: keteranganDitolak,
    alasanNominal: nominalDitolak,
    keteranganTersimpan: valid ? bersih : null,
  };
}

/**
 * Total Biaya operasional, misalnya sebulan di halaman Biaya operasional (PRD §14.4): jumlah nominal setiap biaya.
 * Hasilnya membawa biaya yang dijumlahkan sebagai bahan hitungnya.
 */
export function totalBiayaOperasional<B extends { nominal: number }>(
  biaya: readonly B[],
) {
  return { total: biaya.reduce((jumlah, b) => jumlah + b.nominal, 0), biaya };
}
