/** Status sebuah Pesanan (PRD §5.7, GLOSSARY). Pesanan baru berstatus Menunggu Pembayaran. */
export const STATUS_PESANAN = [
  "Menunggu Pembayaran",
  "Selesai",
  "Kedaluwarsa",
  "Dibatalkan",
  "Bermasalah",
  "Dana Dikembalikan",
] as const;

export type StatusPesanan = (typeof STATUS_PESANAN)[number];

/**
 * Status tujuan yang boleh dicapai dari setiap status (PRD §5.7):
 * - Menunggu Pembayaran → Selesai, Kedaluwarsa, Dibatalkan, atau Bermasalah;
 * - Kedaluwarsa atau Dibatalkan → Selesai atau Bermasalah, hanya karena kabar pembayaran terlambat (§5.9);
 * - Bermasalah → Selesai atau Dana Dikembalikan, oleh Admin.
 */
const TUJUAN_BOLEH: Record<StatusPesanan, readonly StatusPesanan[]> = {
  "Menunggu Pembayaran": ["Selesai", "Kedaluwarsa", "Dibatalkan", "Bermasalah"],
  Kedaluwarsa: ["Selesai", "Bermasalah"],
  Dibatalkan: ["Selesai", "Bermasalah"],
  Bermasalah: ["Selesai", "Dana Dikembalikan"],
  Selesai: [],
  "Dana Dikembalikan": [],
};

/** Apakah Pesanan boleh berpindah dari status `dari` ke status `ke` (PRD §5.7). */
export function perpindahanStatusPesanan({
  dari,
  ke,
}: {
  dari: StatusPesanan;
  ke: StatusPesanan;
}) {
  return { boleh: TUJUAN_BOLEH[dari].includes(ke) };
}
