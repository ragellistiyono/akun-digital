// Kapan Voucher boleh dihapus Admin (PRD §8.8).
import type { StatusPesanan } from "./status-pesanan";

/**
 * Apakah sebuah Voucher boleh dihapus (PRD §8.8), menurut jumlah Pesanan per status yang mencatatnya. Voucher
 * yang pernah tercatat di Pesanan berstatus apa pun, termasuk Kedaluwarsa dan Dibatalkan, tidak bisa dihapus,
 * hanya dinonaktifkan. Jadi Pesanan semua status dihitung, berbeda dengan pemakaian Voucher (§8.5). Bila
 * ditolak, hasilnya membawa jumlah Pesanan itu sebagai sebabnya.
 */
export function bolehHapusVoucher({
  jumlahPesananPerStatus,
}: {
  jumlahPesananPerStatus: Partial<Record<StatusPesanan, number>>;
}): { boleh: true } | { boleh: false; jumlahPesanan: number } {
  const jumlahPesanan = Object.values(jumlahPesananPerStatus).reduce(
    (total, jumlah) => total + jumlah,
    0,
  );
  return jumlahPesanan === 0
    ? { boleh: true }
    : { boleh: false, jumlahPesanan };
}
