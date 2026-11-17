// Aturan kode Voucher di form dasbor admin (PRD §8.1, §8.4 ▶ Keputusan 2026-11-17).

/** Panjang kode Voucher terpendek dan terpanjang, dalam karakter. */
const PANJANG_KODE_VOUCHER = { minimum: 3, maksimum: 20 } as const;

export type AlasanKodeVoucherDitolak =
  | "kosong"
  | "terlalu-pendek"
  | "terlalu-panjang"
  | "karakter-tidak-sah"
  | "kembar";

type HasilPeriksaKodeVoucher =
  | { sah: true; kode: string; alasan: null }
  | { sah: false; kode: null; alasan: AlasanKodeVoucherDitolak };

const ditolak = (
  alasan: AlasanKodeVoucherDitolak,
): HasilPeriksaKodeVoucher => ({
  sah: false,
  kode: null,
  alasan,
});

/** Kode Voucher dalam bentuk simpannya: tanpa spasi di awal dan akhir, dalam huruf besar. */
const kodeBaku = (kode: string) => kode.trim().toUpperCase();

/**
 * Memeriksa kode Voucher baru dan mengembalikan kode dalam bentuk simpannya. Spasi di awal dan akhir
 * dibuang, lalu kode ditulis huruf besar. Kode hanya berisi huruf A–Z dan angka 0–9, 3 sampai 20 karakter,
 * dan tidak boleh sama dengan kode Voucher lain (`kodeLain`) tanpa membedakan huruf besar dan kecil.
 * Pemeriksaannya berurutan: kosong, panjang, karakter, lalu kembar. Alasan pertama yang gagal dikembalikan.
 */
export function periksaKodeVoucher({
  kode,
  kodeLain,
}: {
  kode: string;
  kodeLain: readonly string[];
}): HasilPeriksaKodeVoucher {
  const baku = kodeBaku(kode);
  if (baku === "") return ditolak("kosong");
  if (baku.length < PANJANG_KODE_VOUCHER.minimum) {
    return ditolak("terlalu-pendek");
  }
  if (baku.length > PANJANG_KODE_VOUCHER.maksimum) {
    return ditolak("terlalu-panjang");
  }
  if (!/^[A-Z0-9]+$/.test(baku)) return ditolak("karakter-tidak-sah");
  if (kodeLain.some((lain) => kodeBaku(lain) === baku)) {
    return ditolak("kembar");
  }
  return { sah: true, kode: baku, alasan: null };
}
