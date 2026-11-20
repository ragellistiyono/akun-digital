/** Status sebuah Top up (PRD §15.4). Top up baru berstatus Menunggu Pembayaran. */
export const STATUS_TOP_UP = [
  "Menunggu Pembayaran",
  "Berhasil",
  "Kedaluwarsa",
  "Dibatalkan",
  "Bermasalah",
  "Dana Dikembalikan",
] as const;

export type StatusTopUp = (typeof STATUS_TOP_UP)[number];

/**
 * Status tujuan yang boleh dicapai dari setiap status (PRD §15.4):
 * - Menunggu Pembayaran → Berhasil, Kedaluwarsa, Dibatalkan, atau Bermasalah;
 * - Kedaluwarsa atau Dibatalkan → Berhasil atau Bermasalah, hanya karena kabar pembayaran terlambat;
 * - Bermasalah → Berhasil atau Dana Dikembalikan, oleh Admin.
 */
const TUJUAN_BOLEH: Record<StatusTopUp, readonly StatusTopUp[]> = {
  "Menunggu Pembayaran": [
    "Berhasil",
    "Kedaluwarsa",
    "Dibatalkan",
    "Bermasalah",
  ],
  Kedaluwarsa: ["Berhasil", "Bermasalah"],
  Dibatalkan: ["Berhasil", "Bermasalah"],
  Bermasalah: ["Berhasil", "Dana Dikembalikan"],
  Berhasil: [],
  "Dana Dikembalikan": [],
};

/** Apakah Top up boleh berpindah dari status `dari` ke status `ke` (PRD §15.4). */
export function perpindahanStatusTopUp({
  dari,
  ke,
}: {
  dari: StatusTopUp;
  ke: StatusTopUp;
}) {
  return { boleh: TUJUAN_BOLEH[dari].includes(ke) };
}
