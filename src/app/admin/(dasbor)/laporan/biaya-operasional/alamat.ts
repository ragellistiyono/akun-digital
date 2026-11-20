// Alamat halaman Biaya operasional di bawah Laporan keuangan (PRD §14.4).
export const ALAMAT_BIAYA_OPERASIONAL = "/admin/laporan/biaya-operasional";

/** Alamat daftar Biaya operasional bulan "YYYY-MM" itu. */
export function alamatBulan(bulan: string) {
  return `${ALAMAT_BIAYA_OPERASIONAL}?bulan=${bulan}`;
}
