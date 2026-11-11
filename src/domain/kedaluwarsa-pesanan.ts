// Kedaluwarsa Pesanan (PRD §5.8). Status yang boleh menjadi Kedaluwarsa ditentukan
// perpindahanStatusPesanan di src/domain/status-pesanan.ts.

/**
 * Apakah waktu kedaluwarsa QRIS sebuah Pesanan sudah tercapai pada waktu `sekarang` (PRD §5.8). Tepat
 * pada waktu kedaluwarsa itu Pesanan sudah Kedaluwarsa: QRIS dengan waktu kedaluwarsa 10.15.00 masih
 * Menunggu Pembayaran pukul 10.14.59, dan sudah Kedaluwarsa pukul 10.15.00.
 */
export function kedaluwarsaPesanan({
  kedaluwarsaPada,
  sekarang,
}: {
  kedaluwarsaPada: Date;
  sekarang: Date;
}) {
  return { kedaluwarsa: sekarang.getTime() >= kedaluwarsaPada.getTime() };
}
