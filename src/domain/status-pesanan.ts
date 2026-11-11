/** Status sebuah Pesanan (PRD §5.7, GLOSSARY). Pesanan baru berstatus Menunggu Pembayaran. */
export const STATUS_PESANAN = [
  "Menunggu Pembayaran",
  "Selesai",
  "Kedaluwarsa",
  "Dibatalkan",
  "Bermasalah",
  "Dana Dikembalikan",
] as const;
