// Pembatalan Pesanan oleh Pembeli (PRD §5.8, ADR-0004). Pesanan yang boleh dibatalkan ditentukan
// perpindahanStatusPesanan di src/domain/status-pesanan.ts.

/** Status pembayaran QRIS menurut Qrispy (docs/referensi/qrispy-api.md bagian 4). */
type StatusPembayaranQris = "pending" | "paid" | "expired" | "cancelled";

/**
 * Jawaban Qrispy atas permintaan pembatalan QRIS. Bila Qrispy menolak, `statusQris` adalah status QRIS
 * itu sesudahnya, atau null bila statusnya juga tidak bisa ditanyakan.
 */
type JawabanPembatalanQris =
  | { pembatalanQris: "diterima" }
  | { pembatalanQris: "ditolak"; statusQris: StatusPembayaranQris | null };

/**
 * Akibat permintaan pembatalan sebuah Pesanan Menunggu Pembayaran (PRD §5.8, ADR-0004):
 * - Qrispy menerima pembatalan QRIS-nya: Pesanan menjadi Dibatalkan;
 * - Qrispy menolak dan status QRIS `paid`: Pesanan diproses sebagai sudah dibayar;
 * - Qrispy menolak dan status QRIS `cancelled` atau `expired`: Pesanan menjadi Dibatalkan;
 * - selain itu, termasuk status yang tidak bisa ditanyakan: pembatalan gagal, Pembeli melihat pesan
 *   gagal, dan Pesanan tetap Menunggu Pembayaran.
 */
export function hasilPembatalanPesanan(jawaban: JawabanPembatalanQris): {
  akibat: "dibatalkan" | "diproses-sebagai-dibayar" | "gagal";
} {
  if (jawaban.pembatalanQris === "diterima") return { akibat: "dibatalkan" };
  switch (jawaban.statusQris) {
    case "paid":
      return { akibat: "diproses-sebagai-dibayar" };
    case "cancelled":
    case "expired":
      return { akibat: "dibatalkan" };
    default:
      return { akibat: "gagal" };
  }
}
